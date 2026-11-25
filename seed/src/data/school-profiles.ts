/**
 * The five schools' profiles for the local demo. Only what the schools say
 * publicly is used: their sites and social pages come from the researched
 * driving-school pages (app/lib/driving-school-pages.ts, each with a
 * source), the phones from their own cars' lettering. Branches are demo
 * branches: their addresses say so, their pins are the towns' centres and
 * their phones are made up (0700 000 ...).
 */
import { DRIVING_SCHOOL_PAGES } from "~/lib/driving-school-pages";

export type ProfileSeed = {
  slug: string;
  owner: string;
  tagline: string;
  about: string;
  phone?: string;
  whatsapp?: string;
  website: string;
};

export const SCHOOL_PROFILES: ProfileSeed[] = [
  {
    slug: "heltz",
    owner: "owner@heltz.test",
    tagline: "Driving lessons in Nairobi",
    about:
      "Heltz Driving Academy teaches learners for the NTSA test from its head office on Tom Mboya Street, Nairobi.",
    website: "https://heltzdrivingschool.com",
  },
  {
    slug: "topgear",
    owner: "owner@topgear.test",
    tagline: "Learn to drive with Top Gear",
    about:
      "Top Gear Driving School trains learners for the NTSA test, with its office on Outer Ring Road, Tena.",
    phone: "0722 784 235",
    website: "https://topgeardrivingschool.co.ke",
  },
  {
    slug: "blixen",
    owner: "owner@blixen.test",
    tagline: "B.A.D.S: Blixen Auto Driving School",
    about:
      "Blixen Auto Driving School (B.A.D.S) teaches learners in its silver and orange cars.",
    phone: "+254 798 338 023",
    website: "https://www.bads.co.ke",
  },
  {
    slug: "aa",
    owner: "owner@aa.test",
    tagline: "AA Kenya's driving school",
    about:
      "AA Driving School is the driving school of the Automobile Association of Kenya.",
    website: "https://www.aakenya.co.ke",
  },
  {
    slug: "petanns",
    owner: "owner@petanns.test",
    tagline: "Shule Ya Wakenya",
    about:
      'Petanns Driving School, "Shule Ya Wakenya", teaches learners in its white, blue and orange cars.',
    whatsapp: "0705 05 05 04",
    website: "https://petannsdrivingschool.co.ke",
  },
];

const NETWORKS: Record<string, string> = {
  facebook: "facebook",
  instagram: "instagram",
  tiktok: "tiktok",
  x: "x",
  youtube: "youtube",
};

/** Social links from the school's researched page, by network. */
export function socialsFor(slug: string): Record<string, string> {
  const page = DRIVING_SCHOOL_PAGES.find((p) => p.schoolSlug === slug);
  const out: Record<string, string> = {};
  for (const link of page?.social ?? []) {
    const network = NETWORKS[link.label.split(":")[0]!.trim().toLowerCase()];
    if (network && link.url.startsWith("https://") && !out[network]) {
      out[network] = link.url;
    }
  }
  return out;
}

/** Town centre pins for the demo branches. */
export const BRANCH_DETAILS: Record<
  string,
  { area: string; lat: number; lng: number }
> = {
  "Nairobi CBD": { area: "Nairobi CBD", lat: -1.2841, lng: 36.8233 },
  Westlands: { area: "Westlands, Nairobi", lat: -1.2676, lng: 36.8108 },
  "Thika Road": { area: "Roysambu, Thika Road", lat: -1.2186, lng: 36.8869 },
  "Nairobi West": { area: "Nairobi West", lat: -1.3074, lng: 36.8172 },
  Kitengela: { area: "Kitengela", lat: -1.476, lng: 36.958 },
  Machakos: { area: "Machakos town", lat: -1.5177, lng: 37.2634 },
  Hurlingham: { area: "Hurlingham, Nairobi", lat: -1.2966, lng: 36.7915 },
  Mombasa: { area: "Mombasa", lat: -4.0435, lng: 39.6682 },
  Nakuru: { area: "Nakuru town", lat: -0.3031, lng: 36.08 },
  Kisumu: { area: "Kisumu", lat: -0.0917, lng: 34.768 },
  Eldoret: { area: "Eldoret", lat: 0.5143, lng: 35.2698 },
};

export const BRANCH_HOURS = {
  mon: { open: "08:00", close: "17:00" },
  tue: { open: "08:00", close: "17:00" },
  wed: { open: "08:00", close: "17:00" },
  thu: { open: "08:00", close: "17:00" },
  fri: { open: "08:00", close: "17:00" },
  sat: { open: "08:00", close: "13:00" },
  sun: null,
};
