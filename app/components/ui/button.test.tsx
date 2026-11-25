import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Button } from "./button";

describe("Button", () => {
  it("renders its one child as the element with asChild", () => {
    const html = renderToString(
      <Button asChild>
        <a href="/levels">Levels</a>
      </Button>,
    );
    expect(html).toMatch(/^<a[^>]*href="\/levels"/);
  });

  it("shows the loader, stays busy and disabled while loading", () => {
    const html = renderToString(<Button isLoading>Save</Button>);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("disabled");
    expect(html).toContain("dr-traffic");
    expect(html).toContain("Save");
  });

  it("renders plainly when not loading", () => {
    const html = renderToString(<Button>Save</Button>);
    expect(html).not.toContain("aria-busy");
    expect(html).not.toContain("dr-traffic");
  });
});
