/**
 * The school-media bucket from the browser, as a DriveRush staff member:
 * row level security lets staff list and upload there and refuses everyone
 * else. Files are named by their content (`<school_id>/<kind>/<16 hex>.<ext>`)
 * and kept for a year, so a name already listed is never sent again.
 */
import type { TypedSupabaseClient } from "../types";

export const SCHOOL_MEDIA = "school-media";
const YEAR = "31536000";

/** The file names already in a school's folder. */
export async function listStoredNames(
  supabase: TypedSupabaseClient,
  folder: string,
): Promise<Set<string>> {
  const names = new Set<string>();
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.storage
      .from(SCHOOL_MEDIA)
      .list(folder, { limit: 1000, offset });
    if (error) throw error;
    for (const item of data) names.add(item.name);
    if (data.length < 1000) return names;
  }
}

/** Uploads one file; one already there under that name counts as done. */
export async function uploadSchoolMedia(
  supabase: TypedSupabaseClient,
  path: string,
  file: Blob,
  contentType: string,
): Promise<void> {
  const { error } = await supabase.storage
    .from(SCHOOL_MEDIA)
    .upload(path, file, { contentType, cacheControl: YEAR, upsert: false });
  if (error && !/exists|duplicate/i.test(error.message)) throw error;
}
