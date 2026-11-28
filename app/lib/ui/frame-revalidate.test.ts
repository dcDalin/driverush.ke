import type { ShouldRevalidateFunctionArgs } from "react-router";
import { describe, expect, it } from "vitest";

import { frameShouldRevalidate } from "./frame-revalidate";

const at = (path: string) => new URL(`http://localhost${path}`);

function args(
  from: string,
  to: string,
  extra: Partial<ShouldRevalidateFunctionArgs> = {},
): ShouldRevalidateFunctionArgs {
  return {
    currentUrl: at(from),
    nextUrl: at(to),
    currentParams: { schoolId: from.split("/")[3] ?? "" },
    nextParams: { schoolId: to.split("/")[3] ?? "" },
    defaultShouldRevalidate: true,
    ...extra,
  } as ShouldRevalidateFunctionArgs;
}

describe("frameShouldRevalidate", () => {
  it("reads nothing again for a tab, a modal or a list's search", () => {
    const s = "/console/schools/a1";
    expect(frameShouldRevalidate(args(`${s}/team`, `${s}/students`))).toBe(
      false,
    );
    expect(frameShouldRevalidate(args(`${s}/team`, `${s}/team/add`))).toBe(
      false,
    );
    expect(
      frameShouldRevalidate(args(`${s}/students`, `${s}/students?iq=amina`)),
    ).toBe(false);
    expect(frameShouldRevalidate(args("/console", "/console/payments"))).toBe(
      false,
    );
  });

  it("reads again after a saved form, a revalidate, or for another school", () => {
    const s = "/console/schools/a1";
    expect(
      frameShouldRevalidate(
        args(`${s}/team`, `${s}/team`, { formMethod: "POST" }),
      ),
    ).toBe(true);
    expect(frameShouldRevalidate(args(`${s}/team`, `${s}/team`))).toBe(true);
    expect(
      frameShouldRevalidate(args(`${s}/team`, "/console/schools/b2/team")),
    ).toBe(true);
  });

  it("leaves a failed form to React Router's default (no reload)", () => {
    expect(
      frameShouldRevalidate(
        args("/school/a1/team/add", "/school/a1/team/add", {
          formMethod: "POST",
          defaultShouldRevalidate: false,
        }),
      ),
    ).toBe(false);
  });
});
