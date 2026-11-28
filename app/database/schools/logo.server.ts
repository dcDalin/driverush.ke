/**
 * A school owner's logo upload, on the server. The owner gate runs first in
 * the route action; this makes the sizes the app shows (WebP, 1024 px wide
 * for the colour logo, 2048 for the white one on brass plates), names the
 * file by its content (`<school_id>/logo/<sha256, 16 hex>.webp`, cached for
 * a year), uploads it with the service role (no client may write the
 * bucket), records it with `school_set_logo`, and removes the file it
 * replaced. Nothing is transformed on request: Supabase's transforms are
 * billed per request.
 */
import { createHash } from "node:crypto";

import { fail, ok, reasonFor, type Result } from "../result";
import { getSupabaseServiceClient } from "../supabase/service.server";

export const SCHOOL_MEDIA = "school-media";
const YEAR = "31536000";
const WIDTH = { logo: 1024, logo_mono: 2048 } as const;

export async function uploadSchoolLogo({
  schoolId,
  kind,
  file,
  actorId,
}: {
  schoolId: string;
  kind: "logo" | "logo_mono";
  file: File;
  actorId: string;
}): Promise<Result<{ path: string }>> {
  const { default: sharp } = await import("sharp");
  let bytes: Buffer;
  let width: number;
  let height: number;
  try {
    const out = await sharp(Buffer.from(await file.arrayBuffer()))
      .rotate()
      .resize({ width: WIDTH[kind], withoutEnlargement: true })
      // A logo needs its edges: near-lossless keeps them at about half the
      // size of true lossless.
      .webp({ nearLossless: true, quality: 60, effort: 5 })
      .toBuffer({ resolveWithObject: true });
    bytes = out.data;
    width = out.info.width;
    height = out.info.height;
  } catch {
    return fail("That file is not a picture we can read.");
  }

  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
  const path = `${schoolId}/logo/${hash}.webp`;
  const admin = getSupabaseServiceClient();
  const upload = await admin.storage.from(SCHOOL_MEDIA).upload(path, bytes, {
    contentType: "image/webp",
    cacheControl: YEAR,
    upsert: false,
  });
  if (upload.error && !/exists/i.test(upload.error.message)) {
    return fail("The upload did not go through. Try again.");
  }

  const recorded = await admin.rpc("school_set_logo", {
    p_school_id: schoolId,
    p_kind: kind,
    p_ref: { path, width, height },
    p_actor: actorId,
  });
  if (recorded.error) return fail(reasonFor(recorded.error));

  // The old file: no profile points at it any more. Best effort.
  const old = recorded.data;
  if (old && old !== path) {
    await admin.storage.from(SCHOOL_MEDIA).remove([old]);
  }
  return ok({ path });
}
