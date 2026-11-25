/**
 * Uploads a school's livery folder (seed/fixtures/liveries/<slug>/, written
 * by `npm run build:sponsors` and the thumb and still scripts) to the
 * school-media bucket and returns the `school_liveries` row that names it.
 *
 * Every file is stored at `<school_id>/livery/<sha256, 16 hex>.<ext>`: the
 * same bytes always land at the same path, so a file already in the bucket is
 * not sent again (one listing per school tells which), and a phone that has
 * it cached keeps it. Files are cached for a year (`cacheControl`), safe
 * because a path never changes meaning.
 *
 * Used by the seed (local) and `npm run livery:publish` (local or hosted).
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";

import type { SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";

import type { Database, Json } from "~/database/types";
import { BOARD_CARS } from "~/lib/board/cars";

export const BUCKET = "school-media";
const YEAR = "31536000";

const TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

export type LiveryMeta = {
  label: string;
  base: string;
  rail: { gold: string; red: string };
  topBoard: { width: number; height: number; cut: number; edge: string };
  brand: { paint: string; ink: string };
  note?: string;
};

export type UploadCount = { uploaded: number; kept: number; pruned?: number };

type Admin = SupabaseClient<Database>;

/** The content name of a file: 16 hex of its sha256, and its extension. */
export function contentName(bytes: Buffer, file: string) {
  const ext = extname(file).toLowerCase().replace(".jpeg", ".jpg");
  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
  return `${hash}${ext}`;
}

/** Names already in a school's folder of the bucket. */
async function storedNames(admin: Admin, folder: string) {
  const names = new Set<string>();
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await admin.storage
      .from(BUCKET)
      .list(folder, { limit: 1000, offset });
    if (error) throw new Error(`Listing ${folder}: ${error.message}`);
    for (const item of data) names.add(item.name);
    if (data.length < 1000) return names;
  }
}

/**
 * Puts files into `<school_id>/<kind>/`, skipping those already there.
 * Returns each file's stored path, by its name in the folder.
 */
export async function uploadFiles(
  admin: Admin,
  schoolId: string,
  kind: "livery" | "logo",
  files: { key: string; file: string }[],
  count: UploadCount,
) {
  const folder = `${schoolId}/${kind}`;
  const stored = await storedNames(admin, folder);
  const paths: Record<string, string> = {};
  for (const { key, file } of files) {
    const bytes = readFileSync(file);
    const name = contentName(bytes, file);
    const contentType = TYPES[extname(file).toLowerCase()];
    if (!contentType)
      throw new Error(`Not a picture the bucket takes: ${file}`);
    if (!stored.has(name)) {
      const { error } = await admin.storage
        .from(BUCKET)
        .upload(`${folder}/${name}`, bytes, {
          contentType,
          cacheControl: YEAR,
          upsert: false,
        });
      if (error && !/exists/i.test(error.message)) {
        throw new Error(`Uploading ${file}: ${error.message}`);
      }
      stored.add(name);
      count.uploaded += 1;
    } else {
      count.kept += 1;
    }
    paths[key] = `${folder}/${name}`;
  }
  return paths;
}

/** Width and height of a picture, for a { path, width, height } reference. */
export async function sizeOf(file: string) {
  const { width, height } = await sharp(file).metadata();
  if (!width || !height) throw new Error(`No size for ${file}`);
  return { width, height };
}

/** The livery folder's files, checked: a missing one stops the upload. */
export function liveryFiles(dir: string) {
  const need = (name: string) => {
    const file = join(dir, name);
    if (!existsSync(file)) throw new Error(`Missing ${file}`);
    return file;
  };
  const meta = JSON.parse(
    readFileSync(need("livery.json"), "utf8"),
  ) as LiveryMeta;
  const cars = BOARD_CARS.map((c) => c.id).filter((car) =>
    existsSync(join(dir, `${car}-wrap4-hi.webp`)),
  );
  if (cars.length === 0) throw new Error(`No car wraps in ${dir}`);
  const thumbsDir = join(dir, "thumbs");
  const stillsDir = join(dir, "stills");
  const thumbs = existsSync(thumbsDir)
    ? readdirSync(thumbsDir)
        .filter((f) => f.endsWith(".webp"))
        .map((f) => ({
          key: `thumb:${f.replace(".webp", "")}`,
          file: join(thumbsDir, f),
        }))
    : [];
  const stills = (
    [
      ["still:poster", "poster.jpg"],
      ["still:poster_2400", "poster-2400.jpg"],
      ["still:og", "og.jpg"],
    ] as const
  )
    .filter(([, f]) => existsSync(join(stillsDir, f)))
    .map(([key, f]) => ({ key, file: join(stillsDir, f) }));
  return {
    meta,
    cars,
    files: [
      ...cars.flatMap((car) => [
        { key: `paint:${car}:hi`, file: need(`${car}-wrap4-hi.webp`) },
        { key: `paint:${car}:lo`, file: need(`${car}-wrap4-lo.webp`) },
      ]),
      { key: "top_board", file: need("topboard.webp") },
      { key: "banner:hi", file: need("banner-hi.webp") },
      { key: "banner:lo", file: need("banner-lo.webp") },
      { key: "poster:logo", file: need("poster-logo.webp") },
      { key: "poster:lessons", file: need("poster-lessons.webp") },
      { key: "marks:full", file: need("logo.png") },
      { key: "marks:mono", file: need("logo-mono.png") },
      ...thumbs,
      ...stills,
    ],
  };
}

/**
 * Uploads a livery folder and returns the row to insert into
 * `school_liveries` (a draft; publishing is a separate step).
 */
export async function uploadLivery(
  admin: Admin,
  schoolId: string,
  dir: string,
  count: UploadCount,
) {
  const { meta, cars, files } = liveryFiles(dir);
  const paths = await uploadFiles(admin, schoolId, "livery", files, count);
  const at = (key: string) => {
    const path = paths[key];
    if (!path) throw new Error(`No upload for ${key}`);
    return path;
  };
  const prefixed = (prefix: string) =>
    Object.fromEntries(
      Object.entries(paths)
        .filter(([key]) => key.startsWith(prefix))
        .map(([key, path]) => [key.slice(prefix.length), path]),
    );
  const top = await sizeOf(files.find((f) => f.key === "top_board")!.file);
  return {
    meta,
    row: {
      school_id: schoolId,
      label: meta.label,
      base_color: meta.base,
      rail: meta.rail as NonNullable<Json>,
      paint: Object.fromEntries(
        cars.map((car) => [
          car,
          { hi: at(`paint:${car}:hi`), lo: at(`paint:${car}:lo`) },
        ]),
      ) as NonNullable<Json>,
      top_board: {
        path: at("top_board"),
        ...top,
        metres: { width: meta.topBoard.width, height: meta.topBoard.height },
        cut: meta.topBoard.cut,
        edge: meta.topBoard.edge,
      } as NonNullable<Json>,
      banner: { hi: at("banner:hi"), lo: at("banner:lo") } as NonNullable<Json>,
      posters: {
        logo: at("poster:logo"),
        lessons: at("poster:lessons"),
      } as NonNullable<Json>,
      marks: {
        full: at("marks:full"),
        mono: at("marks:mono"),
      } as NonNullable<Json>,
      thumbs: prefixed("thumb:") as NonNullable<Json>,
      stills: prefixed("still:") as NonNullable<Json>,
    } satisfies Database["public"]["Tables"]["school_liveries"]["Insert"],
  };
}

/**
 * Uploads a logo (and its white version) for a school's profile and records
 * it with school_set_logo, as the dashboard's upload does. Returns the paths
 * it replaced.
 */
export async function uploadLogos(
  admin: Admin,
  schoolId: string,
  logos: { logo?: string; logo_mono?: string },
  count: UploadCount,
) {
  const entries = Object.entries(logos).filter(
    (e): e is [string, string] => typeof e[1] === "string",
  );
  const paths = await uploadFiles(
    admin,
    schoolId,
    "logo",
    entries.map(([key, file]) => ({ key, file })),
    count,
  );
  for (const [kind, file] of entries) {
    const { width, height } = await sizeOf(file);
    const { error } = await admin.rpc("school_set_logo", {
      p_school_id: schoolId,
      p_kind: kind,
      p_ref: { path: paths[kind]!, width, height },
      p_actor: null as unknown as string,
    });
    if (error) throw new Error(`school_set_logo ${kind}: ${error.message}`);
  }
}

/**
 * Removes the folders of schools that no longer exist (a reset gives every
 * school a new id), through the Storage API so the files go too: deleting
 * `storage.objects` rows in SQL would leave them behind.
 */
export async function pruneOrphanFolders(admin: Admin, schoolIds: Set<string>) {
  const { data: folders, error } = await admin.storage
    .from(BUCKET)
    .list("", { limit: 1000 });
  if (error) throw new Error(`Listing ${BUCKET}: ${error.message}`);
  let removed = 0;
  for (const folder of folders) {
    if (schoolIds.has(folder.name)) continue;
    for (const kind of ["livery", "logo"]) {
      const names = await storedNames(admin, `${folder.name}/${kind}`);
      const paths = [...names].map((name) => `${folder.name}/${kind}/${name}`);
      for (let i = 0; i < paths.length; i += 100) {
        const { error: removeError } = await admin.storage
          .from(BUCKET)
          .remove(paths.slice(i, i + 100));
        if (removeError)
          throw new Error(`Removing old files: ${removeError.message}`);
      }
      removed += paths.length;
    }
  }
  return removed;
}
