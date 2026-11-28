import { describe, expect, it } from "vitest";

import type { BoardSchool } from "~/schemas/board-schools";

import {
  clockTime,
  hasOwnWords,
  internationalPhone,
  mapsHref,
  schoolProfileLd,
  todayInKenya,
  toPublicSchool,
  whatsappHref,
} from "./public-profile";

const ID = "3deecceb-12e3-4846-916e-bc757b7e7ab2";
const row: BoardSchool = {
  slug: "heltz",
  name: "Heltz Driving Academy",
  sponsoring: true,
  livery: null,
  profile: {
    tagline: " Driving lessons in Nairobi ",
    about: "First paragraph.\n\nSecond paragraph.",
    phone: "0712 345 678",
    whatsapp: "+254 712 345 678",
    email: "hello@heltz.test",
    website_url: "https://heltz.test",
    socials: {
      tiktok: "https://tiktok.com/@heltz",
      facebook: "https://facebook.com/heltz",
      myspace: "https://myspace.com/heltz",
    },
    brand_paint: "#f5a623",
    brand_ink: "#111111",
    logo: {
      path: `${ID}/logo/0123456789abcdef.webp`,
      width: 1024,
      height: 512,
    },
    logo_mono: null,
  },
  branches: [
    {
      name: "Nairobi CBD",
      town: "Nairobi",
      address: "Tom Mboya Street",
      lat: -1.283,
      lng: 36.825,
      phone: "0700 000 101",
      hours: {
        mon: { open: "08:00", close: "17:00" },
        sun: null,
      },
    },
    {
      name: "Thika",
      town: null,
      address: null,
      lat: null,
      lng: null,
      phone: null,
      hours: null,
    },
  ],
};

describe("a school's public profile", () => {
  const school = toPublicSchool(row, "http://127.0.0.1:54721");

  it("reads the school's own words", () => {
    expect(school.tagline).toBe("Driving lessons in Nairobi");
    expect(school.about).toEqual(["First paragraph.", "Second paragraph."]);
    expect(school.logo?.src).toBe(
      `http://127.0.0.1:54721/storage/v1/object/public/school-media/${ID}/logo/0123456789abcdef.webp`,
    );
    expect(hasOwnWords(school)).toBe(true);
  });

  it("keeps known socials only, in a fixed order", () => {
    expect(school.socials.map((s) => s.label)).toEqual(["Facebook", "TikTok"]);
  });

  it("keeps only the days a branch gave, in week order", () => {
    const [cbd, thika] = school.branches;
    expect(cbd?.week).toEqual([
      { key: "mon", day: "Monday", hours: { open: "08:00", close: "17:00" } },
      { key: "sun", day: "Sunday", hours: null },
    ]);
    expect(cbd?.pin).toEqual({ lat: -1.283, lng: 36.825 });
    expect(thika?.week).toEqual([]);
    expect(thika?.pin).toBeNull();
  });

  it("says when a school wrote nothing of its own", () => {
    const bare = toPublicSchool({ ...row, profile: null }, "x");
    expect(hasOwnWords(bare)).toBe(false);
    expect(bare.branches).toHaveLength(2);
  });
});

describe("links and times", () => {
  it("writes Kenyan numbers internationally", () => {
    expect(internationalPhone("0712 345 678")).toBe("+254712345678");
    expect(internationalPhone("254712345678")).toBe("+254712345678");
    expect(internationalPhone("+254 712 345 678")).toBe("+254712345678");
  });

  it("opens WhatsApp with a first line", () => {
    const href = whatsappHref("0712 345 678", "Heltz");
    expect(href.startsWith("https://wa.me/254712345678?text=")).toBe(true);
    expect(decodeURIComponent(href)).toContain("Hello Heltz");
  });

  it("points the map at the pin", () => {
    expect(mapsHref({ lat: -1.283, lng: 36.825 })).toBe(
      "https://www.google.com/maps/search/?api=1&query=-1.283,36.825",
    );
  });

  it("reads clock times", () => {
    expect(clockTime("08:00")).toBe("8:00 am");
    expect(clockTime("12:30")).toBe("12:30 pm");
    expect(clockTime("17:00")).toBe("5:00 pm");
    expect(clockTime("00:15")).toBe("12:15 am");
  });

  it("knows today's day in Nairobi, not UTC", () => {
    // 22:30 UTC on a Sunday is 01:30 Monday in Nairobi.
    expect(todayInKenya(new Date("2026-11-29T22:30:00Z"))).toBe("mon");
  });
});

describe("structured data", () => {
  it("lists each branch with its address, pin and hours", () => {
    const ld = schoolProfileLd(
      toPublicSchool(row, "http://127.0.0.1:54721"),
    ) as Record<string, unknown> & { department: Record<string, unknown>[] };
    expect(ld.telephone).toBe("+254712345678");
    expect(ld.sameAs).toEqual([
      "https://heltz.test",
      "https://facebook.com/heltz",
      "https://tiktok.com/@heltz",
    ]);
    expect(ld.department[0]).toMatchObject({
      name: "Heltz Driving Academy, Nairobi CBD",
      address: { streetAddress: "Tom Mboya Street", addressCountry: "KE" },
      geo: { latitude: -1.283, longitude: 36.825 },
      openingHoursSpecification: [
        { dayOfWeek: "Monday", opens: "08:00", closes: "17:00" },
      ],
    });
    expect(ld.department[1]).toEqual({
      "@type": "DrivingSchool",
      name: "Heltz Driving Academy, Thika",
    });
  });
});
