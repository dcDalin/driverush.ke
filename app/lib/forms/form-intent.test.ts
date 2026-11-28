import { describe, expect, it } from "vitest";

import { formFields, readFormIntent } from "./form-intent";

describe("readFormIntent", () => {
  it("reads a raw and a JSON-quoted intent", () => {
    const raw = new FormData();
    raw.set("intent", "release-student");
    expect(readFormIntent(raw)).toBe("release-student");
    const quoted = new FormData();
    quoted.set("intent", JSON.stringify("add-student"));
    expect(readFormIntent(quoted)).toBe("add-student");
  });
  it("is empty when there is none", () => {
    expect(readFormIntent(new FormData())).toBe("");
  });
});

describe("formFields", () => {
  it("keeps text fields only", () => {
    const form = new FormData();
    form.set("a", "1");
    form.set("file", new Blob(["x"]));
    expect(formFields(form)).toEqual({ a: "1" });
  });
});
