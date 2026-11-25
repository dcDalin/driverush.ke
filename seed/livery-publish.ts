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
 * It works as a DriveRush staff member, signed in with a password, the same
 * as the console: row level security lets staff upload to school-media and
 * add a draft livery, and nobody else (no service role key is used, so none
 * has to sit on a laptop). Locally that is the demo su (su@driverush.test).
 *
 * --hosted reads LIVERY_SUPABASE_URL and LIVERY_SUPABASE_PUBLISHABLE_KEY
 * (both public; .env.local), asks for your staff email (or reads
 * LIVERY_STAFF_EMAIL) and your password (typed, never stored), then asks you
 * to type the slug before it writes anything.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "~/database/types";

import { assertLocalStack } from "./src/guard";
import { LOCAL_API_URL, signInAs, sql } from "./src/local";
import { type UploadCount, uploadLivery } from "./src/media";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

const STAFF_ROLES = new Set(["driverush_su", "driverush_admin"]);

/** The `user_role` claim the access token hook gave this session. */
function roleOf(accessToken: string) {
  const payload = accessToken.split(".")[1] ?? "";
  try {
    return (
      JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
        user_role?: string;
      }
    ).user_role;
  } catch {
    return undefined;
  }
}

/** Reads a line without showing it (a password). */
function askHidden(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const input = process.stdin;
    let value = "";
    process.stdout.write(question);
    input.setRawMode(true);
    input.resume();
    input.setEncoding("utf8");
    const done = (error?: Error) => {
      input.setRawMode(false);
      input.pause();
      input.off("data", onData);
      process.stdout.write("\n");
      if (error) reject(error);
      else resolve(value);
    };
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") return done();
        if (ch === "\u0003") return done(new Error("Nothing changed."));
        if (ch === "\u007f" || ch === "\b") value = value.slice(0, -1);
        else value += ch;
      }
    };
    input.on("data", onData);
  });
}

/** Signs in to the hosted project as a staff member, after asking first. */
async function hostedStaff(slug: string) {
  const url = process.env.LIVERY_SUPABASE_URL;
  const key = process.env.LIVERY_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "--hosted needs LIVERY_SUPABASE_URL and LIVERY_SUPABASE_PUBLISHABLE_KEY (in .env.local).",
    );
  }
  if (!process.stdin.isTTY) {
    throw new Error("--hosted asks for your password: run it in a terminal.");
  }
  const project = new URL(url).hostname.split(".")[0];
  const ask = async (question: string) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    const answer = await rl.question(question);
    rl.close();
    return answer.trim();
  };
  const email =
    process.env.LIVERY_STAFF_EMAIL?.trim() ||
    (await ask("Your DriveRush staff email: "));
  const password = await askHidden("Password: ");

  const client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data.session) {
    throw new Error(`Sign-in failed: ${error?.message ?? "no session"}`);
  }
  if (!STAFF_ROLES.has(roleOf(data.session.access_token) ?? "")) {
    throw new Error(`${email} is not DriveRush staff. Nothing changed.`);
  }
  const answer = await ask(
    `Publish to the HOSTED project ${project} as ${email}. Type the slug (${slug}) to go on: `,
  );
  if (answer !== slug) throw new Error("Nothing changed.");
  return client;
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

  // A staff session: the database's own rules decide what it may do.
  let staff;
  if (hosted) {
    staff = await hostedStaff(slug);
  } else {
    await assertLocalStack();
    staff = await signInAs("su@driverush.test");
  }

  const { data: school, error } = await staff
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
  const { row } = await uploadLivery(staff, school.id, dir, count);
  const { data: livery, error: insertError } = await staff
    .from("school_liveries")
    .insert(row)
    .select("id")
    .single();
  if (insertError) throw new Error(insertError.message);

  if (live) {
    const { error: publishError } = await staff.rpc("admin_publish_livery", {
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
