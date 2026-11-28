import { describe, expect, it } from "vitest";

import type { TypedSupabaseClient } from "../types";
import { getCaller } from "./get-caller";
import { isStaffRole, isSuRole, parseRole } from "./roles";

function clientReturning(result: {
  data: { claims: Record<string, unknown> } | null;
  error: Error | null;
}): TypedSupabaseClient {
  return {
    auth: { getClaims: async () => result },
  } as unknown as TypedSupabaseClient;
}

describe("getCaller", () => {
  it("is a signed-in caller with the verified role", async () => {
    const caller = await getCaller(
      clientReturning({
        data: { claims: { sub: "u-1", user_role: "driverush_admin" } },
        error: null,
      }),
    );
    expect(caller).toEqual({
      signedIn: true,
      userId: "u-1",
      role: "driverush_admin",
    });
  });

  it("is a plain user when the role claim is missing or unknown", async () => {
    for (const user_role of [undefined, "god_mode", 7]) {
      const caller = await getCaller(
        clientReturning({
          data: { claims: { sub: "u-1", user_role } },
          error: null,
        }),
      );
      expect(caller.role).toBe("user");
    }
  });

  it("is no session when the token is missing, forged or has no subject", async () => {
    expect(
      (
        await getCaller(
          clientReturning({ data: null, error: new Error("bad") }),
        )
      ).signedIn,
    ).toBe(false);
    expect(
      (
        await getCaller(
          clientReturning({ data: { claims: { sub: "" } }, error: null }),
        )
      ).signedIn,
    ).toBe(false);
  });
});

describe("roles", () => {
  it("knows staff and su", () => {
    expect(isStaffRole("driverush_admin")).toBe(true);
    expect(isStaffRole("user")).toBe(false);
    expect(isSuRole("driverush_admin")).toBe(false);
    expect(parseRole("driverush_su")).toBe("driverush_su");
  });
});
