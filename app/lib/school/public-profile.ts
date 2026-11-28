/**
 * A school's public face on its driving-school page (owner, 2026-11-26): what
 * the school itself says on DriveRush (its owner edits it on the dashboard),
 * from the same `board_schools()` row the board reads. Plain functions, so the
 * page, its structured data and the tests share one reading.
 */
import type { BoardSchool } from "~/schemas/board-schools";

import { mediaUrl } from "../board/school-catalog";

export const DAYS = [
  ["mon", "Monday"],
  ["tue", "Tuesday"],
  ["wed", "Wednesday"],
  ["thu", "Thursday"],
  ["fri", "Friday"],
  ["sat", "Saturday"],
  ["sun", "Sunday"],
] as const;
export type DayKey = (typeof DAYS)[number][0];

export type OpeningDay = {
  key: DayKey;
  day: string;
  /** null: closed that day. */
  hours: { open: string; close: string } | null;
};

export type PublicBranch = {
  name: string;
  town: string | null;
  address: string | null;
  pin: { lat: number; lng: number } | null;
  phone: string | null;
  /** Only the days the school gave; empty when it gave no hours. */
  week: OpeningDay[];
};

export type PublicSchool = {
  slug: string;
  name: string;
  tagline: string | null;
  /** The about text, in paragraphs. */
  about: string[];
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  socials: { network: string; label: string; url: string }[];
  colors: { paint: string; ink: string } | null;
  logo: { src: string; width: number; height: number } | null;
  branches: PublicBranch[];
};

const SOCIAL_LABEL: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  x: "X",
  youtube: "YouTube",
};
const SOCIAL_ORDER = Object.keys(SOCIAL_LABEL);

export function toPublicSchool(row: BoardSchool, base: string): PublicSchool {
  const p = row.profile;
  return {
    slug: row.slug,
    name: row.name,
    tagline: p?.tagline?.trim() || null,
    about: (p?.about ?? "")
      .split(/\n\s*\n/)
      .map((para) => para.trim())
      .filter(Boolean),
    phone: p?.phone?.trim() || null,
    whatsapp: p?.whatsapp?.trim() || null,
    email: p?.email?.trim() || null,
    website: p?.website_url?.trim() || null,
    socials: Object.entries(p?.socials ?? {})
      .filter(
        ([network, url]) => SOCIAL_LABEL[network] && /^https:\/\//.test(url),
      )
      .sort(([a], [b]) => SOCIAL_ORDER.indexOf(a) - SOCIAL_ORDER.indexOf(b))
      .map(([network, url]) => ({
        network,
        label: SOCIAL_LABEL[network]!,
        url,
      })),
    colors:
      p?.brand_paint && p.brand_ink
        ? { paint: p.brand_paint, ink: p.brand_ink }
        : null,
    logo: p?.logo
      ? {
          src: mediaUrl(base, p.logo.path),
          width: p.logo.width,
          height: p.logo.height,
        }
      : null,
    branches: row.branches.map((b) => ({
      name: b.name,
      town: b.town?.trim() || null,
      address: b.address?.trim() || null,
      pin: b.lat !== null && b.lng !== null ? { lat: b.lat, lng: b.lng } : null,
      phone: b.phone?.trim() || null,
      week: DAYS.flatMap(([key, day]) =>
        b.hours && key in b.hours
          ? [{ key, day, hours: b.hours[key] ?? null }]
          : [],
      ),
    })),
  };
}

/** Whether the school has said anything worth a section of its own. */
export function hasOwnWords(school: PublicSchool) {
  return Boolean(
    school.tagline ||
    school.about.length ||
    school.phone ||
    school.whatsapp ||
    school.email ||
    school.website ||
    school.socials.length,
  );
}

/** Kenyan numbers in the international form: 0712 345 678 → +254712345678. */
export function internationalPhone(phone: string) {
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("254")) return `+${digits}`;
  if (digits.startsWith("0")) return `+254${digits.slice(1)}`;
  return digits;
}

export function telHref(phone: string) {
  return `tel:${internationalPhone(phone)}`;
}

/** A WhatsApp chat with the school, with a first line ready to send. */
export function whatsappHref(number: string, schoolName: string) {
  const to = internationalPhone(number).replace(/^\+/, "");
  const text = `Hello ${schoolName}, I found you on DriveRush and would like to ask about lessons.`;
  return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
}

/** The branch on Google Maps (directions open from there). */
export function mapsHref(pin: { lat: number; lng: number }) {
  return `https://www.google.com/maps/search/?api=1&query=${pin.lat},${pin.lng}`;
}

/** "08:00" → "8:00 am", "17:30" → "5:30 pm". */
export function clockTime(hhmm: string) {
  const [h = 0, m = 0] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** Today's day key in Nairobi. */
export function todayInKenya(now = new Date()): DayKey {
  const day = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    weekday: "short",
  })
    .format(now)
    .toLowerCase()
    .slice(0, 3);
  return (DAYS.find(([key]) => key === day)?.[0] ?? "mon") as DayKey;
}

/**
 * The school for a page's structured data (schema.org DrivingSchool): its
 * own description, logo, contacts and each branch as a department with its
 * address, map pin and opening hours. Only what the school gave.
 */
export function schoolProfileLd(school: PublicSchool) {
  const sameAs = [
    ...(school.website ? [school.website] : []),
    ...school.socials.map((s) => s.url),
  ];
  return {
    ...(school.tagline || school.about[0]
      ? { description: school.tagline ?? school.about[0] }
      : {}),
    ...(school.logo ? { logo: school.logo.src } : {}),
    ...(school.phone ? { telephone: internationalPhone(school.phone) } : {}),
    ...(school.email ? { email: school.email } : {}),
    ...(sameAs.length ? { sameAs } : {}),
    ...(school.branches.length
      ? {
          department: school.branches.map((b) => ({
            "@type": "DrivingSchool",
            name: `${school.name}, ${b.name}`,
            ...(b.address || b.town
              ? {
                  address: {
                    "@type": "PostalAddress",
                    ...(b.address ? { streetAddress: b.address } : {}),
                    ...(b.town ? { addressLocality: b.town } : {}),
                    addressCountry: "KE",
                  },
                }
              : {}),
            ...(b.pin
              ? {
                  geo: {
                    "@type": "GeoCoordinates",
                    latitude: b.pin.lat,
                    longitude: b.pin.lng,
                  },
                }
              : {}),
            ...(b.phone ? { telephone: internationalPhone(b.phone) } : {}),
            ...(b.week.some((d) => d.hours)
              ? {
                  openingHoursSpecification: b.week.flatMap((d) =>
                    d.hours
                      ? [
                          {
                            "@type": "OpeningHoursSpecification",
                            dayOfWeek: d.day,
                            opens: d.hours.open,
                            closes: d.hours.close,
                          },
                        ]
                      : [],
                  ),
                }
              : {}),
          })),
        }
      : {}),
  };
}
