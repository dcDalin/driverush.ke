import { describe, expect, it } from "vitest";

import { gaHeadScript, sanitizeGaParams } from "./ga";

describe("sanitizeGaParams", () => {
  it("drops empty values and trims to GA4's limits", () => {
    const out = sanitizeGaParams({
      a: undefined,
      b: null,
      c: "x".repeat(150),
      d: Number.NaN,
      e: 3,
      f: false,
      ["k".repeat(50)]: "v",
    });
    expect(out).toEqual({
      c: "x".repeat(100),
      e: 3,
      f: false,
      ["k".repeat(40)]: "v",
    });
  });

  it("keeps at most 25 parameters", () => {
    const many = Object.fromEntries(
      Array.from({ length: 30 }, (_, i) => [`p${i}`, i]),
    );
    expect(Object.keys(sanitizeGaParams(many))).toHaveLength(25);
  });
});

describe("gaHeadScript", () => {
  it("is empty when this environment has no GA property", () => {
    expect(
      gaHeadScript({ content_group: "Home", page_template: "/" }, ""),
    ).toBe("");
  });

  it("is valid JavaScript that can't be broken out of", () => {
    const script = gaHeadScript(
      {
        content_group: "</script><script>alert(1)",
        page_template: "/",
      },
      "G-TEST",
    );
    expect(script).not.toContain("</script>");
    expect(() => new Function(script)).not.toThrow();
  });

  const script = gaHeadScript(
    { content_group: "Home", page_template: "/" },
    "G-TEST",
  );
  /** Runs the head script in a fake browser; resolves once any check is done. */
  const run = async (
    navigator: Record<string, unknown>,
    {
      measure,
      search = "",
    }: { measure?: "1" | "0" | boolean; search?: string } = {},
  ) => {
    const win: Record<string, unknown> = {};
    const session = new Map<string, string>();
    if (measure === "1" || measure === "0") session.set("dr:measure", measure);
    const store = (map = new Map<string, string>()) => ({
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => map.set(key, value),
      removeItem: (key: string) => map.delete(key),
    });
    const asked: string[] = [];
    let answered: Promise<unknown> = Promise.resolve();
    const fetch = (url: string) => {
      asked.push(url);
      const response = Promise.resolve({
        json: () => Promise.resolve({ measure: measure === true }),
      });
      answered = response.then(() => new Promise((r) => setTimeout(r)));
      return response;
    };
    new Function(
      "window",
      "location",
      "document",
      "navigator",
      "sessionStorage",
      "localStorage",
      "matchMedia",
      "fetch",
      script,
    )(
      win,
      { search, pathname: "/", origin: "https://driverush.ke" },
      {
        title: "Home",
        referrer: "",
        createElement: () => ({}),
        head: { appendChild() {} },
      },
      navigator,
      store(session),
      store(),
      () => ({ matches: false }),
      fetch,
    );
    await answered;
    return {
      measured: "__drGa" in win,
      asked,
      dataLayer: (win.dataLayer ?? []) as unknown[][],
      session,
    };
  };
  const phone =
    "Mozilla/5.0 (Linux; Android 11; CUBOT X30) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

  it("stays quiet in a headless or bot browser, and measures a phone", async () => {
    const yes = { measure: "1" } as const;
    expect((await run({ userAgent: phone }, yes)).measured).toBe(true);
    expect(
      (await run({ userAgent: phone, webdriver: true }, yes)).measured,
    ).toBe(false);
    expect(
      (
        await run(
          { userAgent: "Mozilla/5.0 HeadlessChrome/131.0.0.0 Safari/537.36" },
          yes,
        )
      ).measured,
    ).toBe(false);
    expect(
      (await run({ userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1)" }, yes))
        .measured,
    ).toBe(false);
    expect(
      (
        await run(
          {
            userAgent: phone,
            userAgentData: { brands: [{ brand: "HeadlessChrome" }] },
          },
          yes,
        )
      ).measured,
    ).toBe(false);
  });

  it("asks the server once a visit, and measures only after a yes", async () => {
    const yes = await run({ userAgent: phone }, { measure: true });
    expect(yes.asked).toEqual(["/api/visit"]);
    expect(yes.measured).toBe(true);
    expect(yes.session.get("dr:measure")).toBe("1");

    const no = await run({ userAgent: phone }, { measure: false });
    expect(no.asked).toEqual(["/api/visit"]);
    expect(no.measured).toBe(false);
    expect(no.session.get("dr:measure")).toBe("0");

    const known = await run({ userAgent: phone }, { measure: "0" });
    expect(known.asked).toEqual([]);
    expect(known.measured).toBe(false);
  });

  it("reports the address with only the query keys worth keeping", async () => {
    const { dataLayer } = await run(
      { userAgent: phone },
      {
        measure: "1",
        search: "?utm_source=tiktok&fbclid=abc&level=first-drive",
      },
    );
    const view = dataLayer.find((args) => args[1] === "page_view")?.[2] as {
      page_location: string;
    };
    expect(view.page_location).toBe(
      "https://driverush.ke/?utm_source=tiktok&level=first-drive",
    );
  });
});
