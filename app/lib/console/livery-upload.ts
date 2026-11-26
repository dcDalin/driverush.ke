/**
 * The console's livery upload, in the browser of a DriveRush staff member:
 * the livery folder they picked is checked against `planLivery`, each file
 * is named by its content (the first 16 hex of its SHA-256, as the seed and
 * `npm run livery:publish` name them), files the bucket already has are
 * skipped, and the rest go straight to school-media with the staff session
 * (row level security lets staff upload; nobody else). The route action then
 * saves the draft row that names them.
 */
import {
  listStoredNames,
  uploadSchoolMedia,
} from "~/database/storage/school-media";
import type { TypedSupabaseClient } from "~/database/types";
import { BOARD_CARS } from "~/lib/board/cars";
import {
  contentTypeOf,
  DEFAULT_LIVERY_META,
  type LiveryMeta,
  LiveryMetaSchema,
  liveryRow,
  planLivery,
} from "~/lib/board/livery-files";

const CAR_IDS = new Set<string>(BOARD_CARS.map((c) => c.id));
const STILL_NAMES = new Set(["poster.jpg", "poster-2400.jpg", "og.jpg"]);

/**
 * Files picked one by one (not as a folder) come without their subfolder.
 * Their names are unique, so they go back where the folder keeps them:
 * `van.webp` is a car picture (`thumbs/`), `og.jpg` a still (`stills/`).
 */
function placed(path: string) {
  if (path.includes("/")) return path;
  const car = path.endsWith(".webp") ? path.slice(0, -".webp".length) : "";
  if (CAR_IDS.has(car)) return `thumbs/${path}`;
  if (STILL_NAMES.has(path)) return `stills/${path}`;
  return path;
}

/** A picked folder: its name and its files by path inside it. */
export type PickedFolder = { name: string; files: Map<string, File> };

/**
 * Reads an `<input webkitdirectory>` pick. Paths come as
 * `<folder>/<file>` (or deeper); the folder name is dropped, so
 * `heltz/thumbs/van.webp` becomes `thumbs/van.webp`.
 */
export function readFolder(list: FileList | null): PickedFolder | null {
  if (!list || list.length === 0) return null;
  const files = new Map<string, File>();
  let name = "";
  for (const file of Array.from(list)) {
    const path = file.webkitRelativePath || file.name;
    const parts = path.split("/");
    if (parts.length > 1) name ||= parts[0] ?? "";
    const inside = parts.length > 1 ? parts.slice(1).join("/") : path;
    // Hidden files (.DS_Store) are not part of a livery.
    if (inside.split("/").some((p) => p.startsWith("."))) continue;
    files.set(placed(inside), file);
  }
  return { name, files };
}

/** The folder's livery.json, read as far as it is valid; defaults for the rest. */
export async function readMeta(folder: PickedFolder): Promise<LiveryMeta> {
  const file = folder.files.get("livery.json");
  const fallback = { ...DEFAULT_LIVERY_META, label: folder.name };
  if (!file) return fallback;
  try {
    const raw = JSON.parse(await file.text()) as Record<string, unknown>;
    const parsed = LiveryMetaSchema.safeParse({ ...fallback, ...raw });
    return parsed.success ? parsed.data : fallback;
  } catch {
    return fallback;
  }
}

async function contentName(file: File, name: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    await file.arrayBuffer(),
  );
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
  const ext = name
    .slice(name.lastIndexOf("."))
    .toLowerCase()
    .replace(".jpeg", ".jpg");
  return `${hex}${ext}`;
}

export type UploadProgress = {
  done: number;
  total: number;
  uploaded: number;
  kept: number;
};

/**
 * Uploads what the bucket lacks and returns the row to save as a draft.
 * Throws with a sentence when something cannot be sent.
 */
export async function uploadLiveryFolder({
  supabase,
  schoolId,
  folder,
  meta,
  onProgress,
}: {
  supabase: TypedSupabaseClient;
  schoolId: string;
  folder: PickedFolder;
  meta: LiveryMeta;
  onProgress: (progress: UploadProgress) => void;
}) {
  const plan = planLivery([...folder.files.keys()]);
  if (plan.missing.length) {
    throw new Error(`The folder is missing ${plan.missing.join(", ")}.`);
  }
  const dir = `${schoolId}/livery`;
  const stored = await listStoredNames(supabase, dir);
  const progress: UploadProgress = {
    done: 0,
    total: plan.parts.length,
    uploaded: 0,
    kept: 0,
  };
  onProgress({ ...progress });

  const paths: Record<string, string> = {};
  // A few at a time: quick on a good line, gentle on a phone hotspot.
  const queue = [...plan.parts];
  const worker = async () => {
    for (let part = queue.shift(); part; part = queue.shift()) {
      const file = folder.files.get(part.name)!;
      const type = contentTypeOf(part.name);
      if (!type)
        throw new Error(`${part.name} is not a picture the bucket takes.`);
      if (file.size > 5 * 1024 * 1024) {
        throw new Error(`${part.name} is over 5 MB.`);
      }
      const name = await contentName(file, part.name);
      if (stored.has(name)) {
        progress.kept += 1;
      } else {
        await uploadSchoolMedia(supabase, `${dir}/${name}`, file, type);
        stored.add(name);
        progress.uploaded += 1;
      }
      paths[part.key] = `${dir}/${name}`;
      progress.done += 1;
      onProgress({ ...progress });
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);

  const roof = folder.files.get("topboard.webp")!;
  const bitmap = await createImageBitmap(roof);
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close();

  return {
    row: liveryRow(schoolId, meta, plan.cars, paths, size),
    uploaded: progress.uploaded,
    kept: progress.kept,
  };
}
