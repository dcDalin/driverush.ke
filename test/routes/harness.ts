/**
 * Calls route loaders and actions the way React Router does, as a given
 * person (thinkrush `apps/admin/test/harness.ts`): a real password sign-in
 * fills a cookie jar, and the request carries those cookies.
 */
import { createServerClient } from "@supabase/ssr";
import { getToast } from "remix-toast";
import { inject } from "vitest";

import { SEED_PASSWORD, serviceClient } from "../db/helpers";

export async function signInCookies(
  email: string,
  password = SEED_PASSWORD,
): Promise<string> {
  const { url, publishableKey } = inject("supabase");
  const jar = new Map<string, string>();
  const client = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (cookies) => {
        for (const { name, value } of cookies) {
          if (value) jar.set(name, value);
          else jar.delete(name);
        }
      },
    },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
}

/** A confirmed account with a password, made for one test. */
export function freshEmail(label: string) {
  return `${label}-${crypto.randomUUID().slice(0, 8)}@routes.test`;
}

export async function makeAccount(label: string, email = freshEmail(label)) {
  const { data, error } = await serviceClient().auth.admin.createUser({
    email,
    password: SEED_PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;
  return { email, id: data.user.id };
}

export function getRequest(path: string, cookie?: string) {
  return new Request(`http://localhost${path}`, {
    headers: cookie ? { Cookie: cookie } : {},
  });
}

/** A form post, with the honeypot's trap field left empty like a person would. */
export function postRequest(
  path: string,
  fields: Record<string, string>,
  cookie?: string,
) {
  const body = new FormData();
  body.set("name__confirm", "");
  for (const [key, value] of Object.entries(fields)) body.set(key, value);
  return new Request(`http://localhost${path}`, {
    method: "POST",
    body,
    headers: cookie ? { Cookie: cookie } : {},
  });
}

/** remix-hook-form posts every value JSON-encoded. */
export function remixFields(
  values: Record<string, unknown>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, JSON.stringify(value)]),
  );
}

type DataResult = { data: unknown; init: ResponseInit | null };

/** What `data()` / remix-toast returned, or the status of what was thrown. */
export async function run(
  fn: () => Promise<unknown>,
): Promise<{ status: number; data: any; headers: Headers }> {
  try {
    const out = (await fn()) as DataResult | Response;
    if (out instanceof Response)
      return { status: out.status, data: null, headers: out.headers };
    const init = out.init ?? {};
    return {
      status: init.status ?? 200,
      data: out.data,
      headers: new Headers(init.headers),
    };
  } catch (thrown) {
    if (thrown instanceof Response)
      return { status: thrown.status, data: null, headers: thrown.headers };
    const result = thrown as DataResult;
    if (result && typeof result === "object" && "init" in result) {
      return {
        status: result.init?.status ?? 500,
        data: result.data,
        headers: new Headers(result.init?.headers),
      };
    }
    throw thrown;
  }
}

/** The flash toast an action set, read back the way the root loader reads it. */
export async function flashOf(headers: Headers): Promise<string> {
  const cookie = (headers.get("set-cookie") ?? "").split(";")[0] ?? "";
  const { toast } = await getToast(
    new Request("http://localhost/", { headers: { Cookie: cookie } }),
  );
  return toast?.message ?? "";
}
