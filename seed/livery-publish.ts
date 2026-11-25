/**
 * Uploads a school's livery folder and records it as a draft
 * (`npm run livery:publish <slug>`), for staff to preview on the board with
 * `?livery=<id>` and publish from the console.
 *
 *   npm run livery:publish heltz                 the local stack
 *   npm run livery:publish heltz -- --live       ...and publish it now
 *   npm run livery:publish heltz -- --hosted     the hosted project (asks first)
 *
 * The folder is seed/fixtures/liveries/<slug>/ (`npm run build:sponsors`
 * writes the art, `build:car-thumbs` and `build:og` the pictures, and
 * livery.json says its colours and roof board). Files already in the bucket
 * are not sent again: only what changed is uploaded, and phones keep the
 * rest cached.
 *
 * --hosted reads LIVERY_SUPABASE_URL and LIVERY_SERVICE_ROLE_KEY (never
 * committed: put them in .env.local) and asks you to type the slug before it
 * writes anything.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "~/database/types";

import { assertLocalStack } from "./src/guard";
import { LOCAL_API_URL, serviceClient, sql } from "./src/local";
import { type UploadCount, uploadLivery } from "./src/media";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

async function hostedClient(slug: string) {
  const url = process.env.LIVERY_SUPABASE_URL;
  const key = process.env.LIVERY_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "--hosted needs LIVERY_SUPABASE_URL and LIVERY_SERVICE_ROLE_KEY (in .env.local).",
    );
  }
  if (!process.stdin.isTTY)
    throw new Error("--hosted asks first: run it in a terminal.");
  const project = new URL(url).hostname.split(".")[0];
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(
    `Publish to the HOSTED project ${project}. Type the slug (${slug}) to go on: `,
  );
  rl.close();
  if (answer.trim() !== slug) throw new Error("Nothing changed.");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function main() {
  const args = process.argv.slice(2);
  const slug = args.find((a) => !a.startsWith("-"));
  const live = args.includes("--live");
  const hosted = args.includes("--hosted");
  if (!slug || args.includes("-h") || args.includes("--help")) {
    console.log("npm run livery:publish <slug> [-- --live] [-- --hosted]");
    return;
  }
  const envFile = join(ROOT, ".env.local");
  if (existsSync(envFile)) process.loadEnvFile(envFile);

  const dir = join(ROOT, "seed", "fixtures", "liveries", slug);
  if (!existsSync(dir)) throw new Error(`No livery folder at ${dir}`);

  let admin;
  if (hosted) {
    admin = await hostedClient(slug);
  } else {
    await assertLocalStack();
    admin = serviceClient();
  }

  const { data: school, error } = await admin
    .from("schools")
    .select("id, name")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!school)
    throw new Error(
      `No school with the slug ${slug}. Create it in the console first.`,
    );

  const count: UploadCount = { uploaded: 0, kept: 0 };
  const { row } = await uploadLivery(admin, school.id, dir, count);
  const { data: livery, error: insertError } = await admin
    .from("school_liveries")
    .insert(row)
    .select("id")
    .single();
  if (insertError) throw new Error(insertError.message);

  if (live) {
    const { error: publishError } = await admin.rpc("admin_publish_livery", {
      p_livery_id: livery.id,
    });
    if (publishError) throw new Error(publishError.message);
  }

  const site = hosted ? "https://driverush.ke" : "http://localhost:5730";
  console.log(
    [
      `${school.name}: ${count.uploaded} files uploaded, ${count.kept} already in Storage.`,
      live
        ? "Published: phones see it within a few minutes."
        : `Draft ${livery.id}. Preview: ${site}/model-town-board/play?livery=${livery.id}`,
      live ? "" : "Then publish it from the console (Schools > Liveries).",
      hosted ? "" : `(local stack at ${LOCAL_API_URL})`,
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end();
    process.exit();
  });
