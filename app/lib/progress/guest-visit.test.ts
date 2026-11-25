import { describe, expect, it } from "vitest";

import { authCookieName, guestVisitScript } from "./guest-visit";
import { ACCOUNTS_SEEN_KEY, LEGACY_KEY, VISIT_KEY } from "./keys";

const URL = "http://127.0.0.1:54721";

function memory(initial: Record<string, string> = {}) {
  const m = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    dump: () => Object.fromEntries(m),
  };
}

/** Runs the exact <head> script against fake storages and cookies. */
function run(
  local: ReturnType<typeof memory>,
  session: ReturnType<typeof memory>,
  cookie = "",
) {
  new Function(
    "localStorage",
    "sessionStorage",
    "document",
    guestVisitScript(URL),
  )(local, session, { cookie });
}

describe("the guest visit script", () => {
  it("is empty when accounts are off", () => {
    expect(guestVisitScript(undefined)).toBe("");
  });

  it("names the Supabase session cookie by project", () => {
    expect(authCookieName(URL)).toBe("sb-127-auth-token");
    expect(authCookieName("https://abcd.supabase.co")).toBe(
      "sb-abcd-auth-token",
    );
  });

  it("sets old progress aside the first time a phone sees accounts", () => {
    const local = memory({
      "driverush:board": '{"state":{}}',
      "dr-theme": "dark",
    });
    run(local, memory());
    expect(local.getItem("driverush:board")).toBeNull();
    expect(JSON.parse(local.getItem(LEGACY_KEY)!)).toEqual({
      "driverush:board": '{"state":{}}',
    });
    expect(local.getItem("dr-theme")).toBe("dark");
  });

  it("keeps a guest's progress through the visit", () => {
    const local = memory({ [ACCOUNTS_SEEN_KEY]: "1" });
    const session = memory();
    run(local, session);
    local.setItem("driverush:streak", '{"days":1}');
    run(local, session);
    expect(local.getItem("driverush:streak")).toBe('{"days":1}');
  });

  it("clears it at the start of the next visit, without touching the set-aside copy", () => {
    const local = memory({
      [ACCOUNTS_SEEN_KEY]: "1",
      [LEGACY_KEY]: "{}",
      "driverush:streak": '{"days":1}',
    });
    run(local, memory());
    expect(local.getItem("driverush:streak")).toBeNull();
    expect(local.getItem(LEGACY_KEY)).toBe("{}");
  });

  it("keeps everything for a signed-in learner, chunked cookie included", () => {
    const local = memory({ [ACCOUNTS_SEEN_KEY]: "1", "driverush:board": "{}" });
    const session = memory();
    run(local, session, "dr=1; sb-127-auth-token.0=base64-abc");
    expect(local.getItem("driverush:board")).toBe("{}");
    expect(session.getItem(VISIT_KEY)).toBeNull();
  });

  it("does not take the code-verifier cookie for a session", () => {
    const local = memory({ [ACCOUNTS_SEEN_KEY]: "1", "driverush:board": "{}" });
    run(local, memory(), "sb-127-auth-token-code-verifier=x");
    expect(local.getItem("driverush:board")).toBeNull();
  });
});
