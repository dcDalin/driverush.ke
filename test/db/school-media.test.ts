/**
 * The school-media bucket and school_liveries through the real APIs, as
 * each person: anyone reads a live livery and its files by URL; only
 * DriveRush staff (password or Google session) list, upload, change and delete; a
 * school owner, a learner, a guest and staff on an emailed-code session are
 * refused. pgTAP (school_media.test.sql) proves the same rules in SQL.
 */
import { randomBytes } from "node:crypto";

import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";

import {
  anonClient,
  type Client,
  schoolIdBySlug,
  serviceClient,
  signInWithEmailCode,
  signInWithPassword,
} from "./helpers";

const BUCKET = "school-media";
let schoolId = "";
let png: Buffer;
let staff: Client;
let owner: Client;

const newPath = () =>
  `${schoolId}/livery/${randomBytes(8).toString("hex")}.png`;

beforeAll(async () => {
  schoolId = await schoolIdBySlug("heltz");
  png = await sharp({
    create: { width: 4, height: 4, channels: 3, background: "#f4a20c" },
  })
    .png()
    .toBuffer();
  staff = await signInWithPassword("admin@driverush.test");
  owner = await signInWithPassword("owner@heltz.test");
});

const upload = (client: Client, path = newPath()) =>
  client.storage
    .from(BUCKET)
    .upload(path, png, { contentType: "image/png", upsert: false });

describe("the school-media bucket", () => {
  it("takes uploads from DriveRush staff, and anyone fetches them by URL", async () => {
    const path = newPath();
    const { error } = await upload(staff, path);
    expect(error).toBeNull();
    const { data } = anonClient().storage.from(BUCKET).getPublicUrl(path);
    const response = await fetch(data.publicUrl);
    expect(response.status).toBe(200);
  });

  it("refuses uploads from a school owner, a guest and staff on a code session", async () => {
    expect((await upload(owner)).error).not.toBeNull();
    expect((await upload(anonClient())).error).not.toBeNull();
    const codeStaff = await signInWithEmailCode("admin@driverush.test");
    expect((await upload(codeStaff)).error).not.toBeNull();
  });

  it("lists only for staff", async () => {
    const path = newPath();
    await upload(staff, path);
    const folder = `${schoolId}/livery`;
    const asStaff = await staff.storage.from(BUCKET).list(folder);
    expect(asStaff.data?.length ?? 0).toBeGreaterThan(0);
    for (const client of [owner, anonClient()]) {
      const { data } = await client.storage.from(BUCKET).list(folder);
      expect(data ?? []).toEqual([]);
    }
  });

  it("lets only staff delete", async () => {
    const path = newPath();
    await upload(staff, path);
    await owner.storage.from(BUCKET).remove([path]);
    const still = await fetch(
      anonClient().storage.from(BUCKET).getPublicUrl(path).data.publicUrl,
    );
    expect(still.status).toBe(200);
    const { error } = await staff.storage.from(BUCKET).remove([path]);
    expect(error).toBeNull();
  });

  it("refuses SVG even from staff (it can carry script)", async () => {
    const { error } = await staff.storage
      .from(BUCKET)
      .upload(
        `${schoolId}/livery/${randomBytes(8).toString("hex")}.svg`,
        "<svg/>",
        {
          contentType: "image/svg+xml",
        },
      );
    expect(error).not.toBeNull();
  });
});

describe("school_liveries rows", () => {
  const draft = async (client: Client) => {
    const paths = Array.from({ length: 4 }, newPath);
    return client
      .from("school_liveries")
      .insert({
        school_id: schoolId,
        label: "API draft",
        base_color: "#ffffff",
        rail: { gold: "#f4a20c", red: "#e3271b" },
        paint: { saloon: { hi: paths[0]!, lo: paths[1]! } },
        marks: { full: paths[2]!, mono: paths[3]! },
      })
      .select("id, status")
      .single();
  };

  it("lets staff add a draft and change it; never a school owner", async () => {
    const made = await draft(staff);
    expect(made.error).toBeNull();
    expect(made.data?.status).toBe("draft");
    const renamed = await staff
      .from("school_liveries")
      .update({ label: "API draft, renamed" })
      .eq("id", made.data!.id)
      .select("label");
    expect(renamed.data?.[0]?.label).toBe("API draft, renamed");

    expect((await draft(owner)).error).not.toBeNull();
    const ownerEdit = await owner
      .from("school_liveries")
      .update({ label: "taken over" })
      .eq("id", made.data!.id)
      .select("id");
    expect(ownerEdit.data ?? []).toEqual([]);

    const removed = await staff
      .from("school_liveries")
      .delete()
      .eq("id", made.data!.id)
      .select("id");
    expect(removed.data).toHaveLength(1);
  });

  it("shows guests live liveries only, never drafts or who made them", async () => {
    const made = await draft(staff);
    const guest = anonClient();
    const { data } = await guest
      .from("school_liveries")
      .select("id, status")
      .eq("school_id", schoolId);
    expect((data ?? []).every((l) => l.status === "live")).toBe(true);
    expect((data ?? []).some((l) => l.id === made.data!.id)).toBe(false);
    const madeBy = await guest.from("school_liveries").select("created_by");
    expect(madeBy.error).not.toBeNull();
    await serviceClient()
      .from("school_liveries")
      .delete()
      .eq("id", made.data!.id);
  });
});
