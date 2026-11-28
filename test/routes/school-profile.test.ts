/**
 * A school's profile from its dashboard: the owner edits the words and
 * uploads logos (resized on the server, stored in school-media by content);
 * a branch admin can do neither. Guests then read it through
 * board_schools().
 */
import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";

import { action, loader } from "~/routes/layouts/school-layout";

import { anonClient, serviceClient } from "../db/helpers";
import {
  flashOf,
  getRequest,
  postRequest,
  remixFields,
  run,
  signInCookies,
} from "./harness";

let schoolId = "";
const cookies: Record<string, string> = {};

beforeAll(async () => {
  const heltz = await serviceClient()
    .from("schools")
    .select("id")
    .eq("slug", "heltz")
    .single();
  schoolId = heltz.data!.id;
  for (const email of ["owner@heltz.test", "westlands.admin@heltz.test"]) {
    cookies[email] = await signInCookies(email);
  }
});

const path = () => `/school/${schoolId}`;
const post = (request: Request) =>
  run(() => action({ request, params: { schoolId }, context: {} } as never));

const profileFields = remixFields({
  intent: "update-profile",
  tagline: "Learn with Heltz",
  about: "Lessons in Nairobi.",
  phone: "0712 345 678",
  whatsapp: "",
  email: "Hello@Heltz.test",
  websiteUrl: "https://heltz.test",
  facebook: "https://facebook.com/heltz",
  instagram: "",
  tiktok: "",
  x: "",
  youtube: "",
  brandPaint: "#F4A20C",
  brandInk: "",
});

async function logoRequest(cookie: string, file: Blob, name = "logo.png") {
  const body = new FormData();
  body.set("name__confirm", "");
  body.set("intent", "upload-logo");
  body.set("kind", "logo");
  body.set("file", file, name);
  return new Request(`http://localhost${path()}`, {
    method: "POST",
    body,
    headers: { Cookie: cookie },
  });
}

async function png(width: number, height: number) {
  const bytes = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 244, g: 162, b: 12, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
  return new Blob([new Uint8Array(bytes)], { type: "image/png" });
}

describe("the school profile", () => {
  it("is saved by the owner, tidied as the database keeps it", async () => {
    const result = await post(
      postRequest(path(), profileFields, cookies["owner@heltz.test"]),
    );
    expect(await flashOf(result.headers)).toMatch(/Profile saved/);
    const { data } = await serviceClient()
      .from("school_profiles")
      .select("tagline, email, brand_paint, socials")
      .eq("school_id", schoolId)
      .single();
    expect(data).toMatchObject({
      tagline: "Learn with Heltz",
      email: "hello@heltz.test",
      brand_paint: "#f4a20c",
      socials: { facebook: "https://facebook.com/heltz" },
    });
  });

  it("is refused to a branch admin", async () => {
    const result = await post(
      postRequest(path(), profileFields, cookies["westlands.admin@heltz.test"]),
    );
    expect(await flashOf(result.headers)).toMatch(/cannot do that here/);
  });

  it("rejects a website that is not https", async () => {
    const result = await post(
      postRequest(
        path(),
        { ...profileFields, websiteUrl: JSON.stringify("http://heltz.test") },
        cookies["owner@heltz.test"],
      ),
    );
    expect(result.data.errors?.websiteUrl).toBeTruthy();
  });
});

describe("the logo upload", () => {
  it("resizes, stores by content and records the owner's logo", async () => {
    const result = await post(
      await logoRequest(cookies["owner@heltz.test"]!, await png(3000, 1000)),
    );
    expect(await flashOf(result.headers)).toMatch(/Logo saved/);
    const { data } = await serviceClient()
      .from("school_profiles")
      .select("logo")
      .eq("school_id", schoolId)
      .single();
    const logo = data!.logo as { path: string; width: number; height: number };
    expect(logo.path).toMatch(
      new RegExp(`^${schoolId}/logo/[0-9a-f]{16}\\.webp$`),
    );
    // Shrunk to the width the app shows, its shape kept.
    expect(logo).toMatchObject({ width: 1024, height: 341 });
    const file = await fetch(
      `${process.env.SUPABASE_URL}/storage/v1/object/public/school-media/${logo.path}`,
    );
    expect(file.status).toBe(200);
    expect(file.headers.get("content-type")).toBe("image/webp");
    expect(file.headers.get("cache-control")).toContain("max-age=31536000");
  });

  it("removes the file it replaces", async () => {
    const before = await serviceClient()
      .from("school_profiles")
      .select("logo")
      .eq("school_id", schoolId)
      .single();
    const old = (before.data!.logo as { path: string }).path;
    await post(
      await logoRequest(cookies["owner@heltz.test"]!, await png(800, 300)),
    );
    const gone = await fetch(
      `${process.env.SUPABASE_URL}/storage/v1/object/public/school-media/${old}`,
    );
    expect(gone.status).not.toBe(200);
  });

  it("is refused to a branch admin before anything is stored", async () => {
    const result = await post(
      await logoRequest(
        cookies["westlands.admin@heltz.test"]!,
        await png(100, 100),
      ),
    );
    expect(result.status).toBe(403);
    expect(await flashOf(result.headers)).toMatch(/Only the school's owner/);
  });

  it("refuses a file that is not a picture", async () => {
    const result = await post(
      await logoRequest(
        cookies["owner@heltz.test"]!,
        new Blob(["<svg onload=alert(1)>"], { type: "image/svg+xml" }),
        "logo.svg",
      ),
    );
    expect(await flashOf(result.headers)).toMatch(/PNG, JPEG or WebP/);
  });

  it("shows on the dashboard and to guests through board_schools()", async () => {
    const { data } = await run(() =>
      loader({
        request: getRequest(path(), cookies["owner@heltz.test"]),
        params: { schoolId },
        context: {},
      } as never),
    );
    expect(data.logos.logo).toMatch(
      /\/storage\/v1\/object\/public\/school-media\//,
    );
    const { data: schools } = await anonClient().rpc("board_schools");
    const heltz = (
      schools as { slug: string; profile: { tagline: string } }[]
    ).find((s) => s.slug === "heltz");
    expect(heltz?.profile.tagline).toBe("Learn with Heltz");
  });
});
