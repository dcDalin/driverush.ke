/**
 * Clients and accounts for the db tests. Accounts sign in the way the app
 * will: a password, or an emailed 6-digit code (generated through the admin
 * API, so no mail is read). Seeded accounts come from supabase/seeds/local_demo.sql.
 */
import { createHmac, randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { inject } from "vitest";

import type { Database } from "~/database/types";

export const SEED_PASSWORD = "driverush-local-1";

export type Client = SupabaseClient<Database>;

export function local() {
  return inject("supabase");
}

export function anonClient(): Client {
  const { url, publishableKey } = local();
  return createClient<Database>(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function serviceClient(): Client {
  const { url, serviceRoleKey } = local();
  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** A fresh address no seed or earlier run has used. */
export function uniqueEmail(label: string) {
  return `${label}-${randomUUID().slice(0, 8)}@vitest.test`;
}

export async function signInWithPassword(
  email: string,
  password = SEED_PASSWORD,
) {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

/**
 * Signs in (or up) with an emailed one-time code, as the app's code sign-in
 * does. The code comes from the admin API instead of the mailbox.
 */
export async function signInWithEmailCode(email: string) {
  const { data, error } = await serviceClient().auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error) throw error;
  const client = anonClient();
  const verified = await client.auth.verifyOtp({
    email,
    token: data.properties.email_otp,
    type: "email",
  });
  if (verified.error) throw verified.error;
  return client;
}

export async function claimsOf(client: Client) {
  const { data, error } = await client.auth.getClaims();
  if (error || !data) throw error ?? new Error("no claims");
  return data.claims;
}

export async function seededBranchId(schoolSlug: string, branchName: string) {
  const { data, error } = await serviceClient()
    .from("school_branches")
    .select("id, schools!inner(slug)")
    .eq("schools.slug", schoolSlug)
    .eq("name", branchName)
    .single();
  if (error) throw error;
  return data.id;
}

/** An HS256 token signed with the wrong secret, claiming whatever it likes. */
export function forgedJwt(claims: Record<string, unknown>) {
  const b64 = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const head = b64({ alg: "HS256", typ: "JWT" });
  const body = b64({ exp: Math.floor(Date.now() / 1000) + 3600, ...claims });
  const sig = createHmac(
    "sha256",
    "not-the-project-secret-but-long-enough-0000",
  )
    .update(`${head}.${body}`)
    .digest("base64url");
  return `${head}.${body}.${sig}`;
}

/** A confirmed account with the demo password, made for one test. */
export async function makeAccount(label: string) {
  const email = uniqueEmail(label);
  const { data, error } = await serviceClient().auth.admin.createUser({
    email,
    password: SEED_PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;
  return { email, id: data.user.id, client: await signInWithPassword(email) };
}

export async function schoolIdBySlug(slug: string) {
  const { data, error } = await serviceClient()
    .from("schools")
    .select("id")
    .eq("slug", slug)
    .single();
  if (error) throw error;
  return data.id;
}
