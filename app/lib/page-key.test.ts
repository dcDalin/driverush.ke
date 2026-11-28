import { describe, expect, it } from "vitest";

import { pageKey } from "~/root";

describe("what counts as a new page for the entrance animation", () => {
  it("is each address on the site", () => {
    expect(pageKey("/guides")).toBe("/guides");
    expect(pageKey("/model-town-board/levels")).toBe(
      "/model-town-board/levels",
    );
    expect(pageKey("/school")).toBe("/school");
  });
  it("is the whole dashboard inside the console, a school and the tools", () => {
    expect(pageKey("/console")).toBe("/console");
    expect(pageKey("/console/schools/abc/team")).toBe("/console");
    expect(pageKey("/school/abc")).toBe("/school/abc");
    expect(pageKey("/school/abc/students/add")).toBe("/school/abc");
    expect(pageKey("/tools/share")).toBe("/tools");
  });
});
