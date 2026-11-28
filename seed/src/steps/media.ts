/**
 * The six schools' look and profile, the way they are made for real:
 *
 * 1. the su uploads their livery folders (seed/fixtures/liveries/<slug>/)
 *    to the school-media bucket (files already there are not sent again) as
 *    a draft `school_liveries` row, and publishes it: the staff path
 *    `npm run livery:publish` takes;
 * 2. each owner fills in their profile and branch details on a session of
 *    their own (school_update_profile, school_update_branch_details), and
 *    the server's upload path records their logos (school_set_logo);
 * 3. the su starts each school's sponsorship, so its cars take turns.
 */
import { join } from "node:path";

import {
  BRANCH_DETAILS,
  BRANCH_HOURS,
  SCHOOL_PROFILES,
  socialsFor,
} from "../data/school-profiles";
import { must, serviceClient, signInAs, sql } from "../local";
import {
  pruneOrphanFolders,
  type UploadCount,
  uploadLivery,
  uploadLogos,
} from "../media";

export async function seedMedia(root: string) {
  const admin = serviceClient();
  const su = await signInAs("su@driverush.test");
  const count: UploadCount = { uploaded: 0, kept: 0, pruned: 0 };
  // The last seed's schools are gone (a reset gives new ids): so are their files.
  const ids = await sql<{ id: string }[]>`select id from public.schools`;
  count.pruned = await pruneOrphanFolders(admin, new Set(ids.map((r) => r.id)));
  let branchPhone = 100;

  for (const profile of SCHOOL_PROFILES) {
    const dir = join(root, "seed", "fixtures", "liveries", profile.slug);
    const [school] = await sql<{ id: string }[]>`
      select id from public.schools where slug = ${profile.slug}`;
    if (!school) throw new Error(`No school ${profile.slug} to dress`);

    // 1. The livery: uploaded by the su (staff may write school-media and
    //    add drafts; row level security refuses everyone else), then
    //    published by the su.
    const { meta, row } = await uploadLivery(su, school.id, dir, count);
    const { data: livery, error } = await su
      .from("school_liveries")
      .insert(row)
      .select("id")
      .single();
    if (error) throw new Error(`Livery for ${profile.slug}: ${error.message}`);
    must(
      `admin_publish_livery ${profile.slug}`,
      await su.rpc("admin_publish_livery", { p_livery_id: livery.id }),
    );

    // 2. The owner's profile, logos and branch details.
    const owner = await signInAs(profile.owner);
    must(
      `school_update_profile ${profile.slug}`,
      await owner.rpc("school_update_profile", {
        p_school_id: school.id,
        p_tagline: profile.tagline,
        p_about: profile.about,
        p_phone: profile.phone ?? "",
        p_whatsapp: profile.whatsapp ?? "",
        p_email: "",
        p_website_url: profile.website,
        p_socials: socialsFor(profile.slug),
        p_brand_paint: meta.brand.paint,
        p_brand_ink: meta.brand.ink,
      }),
    );
    await uploadLogos(
      admin,
      school.id,
      { logo: join(dir, "logo.png"), logo_mono: join(dir, "logo-mono.png") },
      count,
    );
    const branches = await sql<{ id: string; name: string }[]>`
      select id, name from public.school_branches where school_id = ${school.id} order by name`;
    for (const branch of branches) {
      const place = BRANCH_DETAILS[branch.name];
      if (!place) continue;
      branchPhone += 1;
      must(
        `school_update_branch_details ${profile.slug}/${branch.name}`,
        await owner.rpc("school_update_branch_details", {
          p_branch_id: branch.id,
          p_address: `${place.area} (demo branch)`,
          p_lat: place.lat,
          p_lng: place.lng,
          p_phone: `0700 000 ${branchPhone}`,
          p_hours: BRANCH_HOURS,
        }),
      );
    }

    // 3. Sponsoring since a month ago, with no end set.
    must(
      `admin_set_sponsorship ${profile.slug}`,
      await su.rpc("admin_set_sponsorship", {
        p_school_id: school.id,
        p_starts_on: new Date(Date.now() - 30 * 86_400_000)
          .toISOString()
          .slice(0, 10),
        p_ends_on: null as unknown as string,
        p_note: "Demo sponsorship",
      }),
    );
  }
  return count;
}
