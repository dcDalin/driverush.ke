/**
 * The signed-in learner, in the browser.
 *
 * Accounts are optional: the board and signs work for guests. The session
 * lives in cookies (`~/lib/supabase/browser.ts`), so server loaders that need
 * it later (school dashboard, console) see the same one. Pages render as a
 * guest on the server and during hydration, then switch once the browser has
 * read the session, so cached and offline pages never depend on it.
 *
 * When the Supabase settings are missing (a build without them), accounts are
 * simply off: `useSession()` stays "off" and nothing asks anyone to sign in.
 *
 * The Supabase client is loaded on demand, after the page is up, so it never
 * weighs on the first load (cheap phones, slow data).
 */
import type { Session, User } from "@supabase/supabase-js";
import * as React from "react";

export type SessionState =
  | { status: "off" }
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "signed-in"; user: User };

/** Whether this build has the Supabase settings that accounts need. */
export function authConfigured(
  env: Record<string, string | undefined> = import.meta.env,
) {
  return Boolean(env.VITE_SUPABASE_URL && env.VITE_SUPABASE_PUBLISHABLE_KEY);
}

const OFF: SessionState = { status: "off" };
const LOADING: SessionState = { status: "loading" };
const SIGNED_OUT: SessionState = { status: "signed-out" };

let state: SessionState = LOADING;
let started = false;
const listeners = new Set<() => void>();

function set(next: SessionState) {
  state = next;
  for (const fn of listeners) fn();
}

function fromSession(session: Session | null): SessionState {
  return session?.user
    ? { status: "signed-in", user: session.user }
    : SIGNED_OUT;
}

function start() {
  if (started) return;
  started = true;
  if (!authConfigured()) {
    set(OFF);
    return;
  }
  void loadClient().then(async (supabase) => {
    // getSession() waits for the client to finish starting, which includes
    // exchanging a sign-in code in the address (the Google return trip).
    const { data } = await supabase.auth.getSession();
    set(fromSession(data.session));
    supabase.auth.onAuthStateChange((_event, session) =>
      set(fromSession(session)),
    );
  });
}

/** The browser's Supabase client, loaded the first time it is needed. */
export async function loadClient() {
  const { getSupabaseBrowserClient } = await import("~/lib/supabase/browser");
  return getSupabaseBrowserClient();
}

function subscribe(onChange: () => void) {
  start();
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

const getSnapshot = () => state;
const getServerSnapshot = () => LOADING;

export function useSession(): SessionState {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Resolves once the browser knows whether someone is signed in. */
export function sessionReady(): Promise<SessionState> {
  start();
  if (state.status !== "loading") return Promise.resolve(state);
  return new Promise((resolve) => {
    const fn = () => {
      if (state.status === "loading") return;
      listeners.delete(fn);
      resolve(state);
    };
    listeners.add(fn);
  });
}

export async function signOut() {
  if (!authConfigured()) return;
  await (await loadClient()).auth.signOut();
}
