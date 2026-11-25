import { describe, expect, it } from "vitest";

import { EmailCodeRequestSchema, VerifyEmailCodeSchema } from "./auth";
import { CreateSchoolSchema } from "./console";
import { AddAdminSchema, StudentActionSchema } from "./school";

const ID = "8a8d6f0e-6d3b-4a7e-9a55-1f0f1c2b3d4e";

describe("form schemas", () => {
  it("normalise an email and explain a bad one", () => {
    expect(
      EmailCodeRequestSchema.parse({ email: "  Wanjiru@Mail.COM " }).email,
    ).toBe("wanjiru@mail.com");
    const bad = EmailCodeRequestSchema.safeParse({ email: "wanjiru" });
    expect(bad.success).toBe(false);
    expect(bad.error?.issues[0]?.message).toMatch(/full email address/);
  });

  it("keep six digits from a pasted code", () => {
    expect(VerifyEmailCodeSchema.parse({ code: "674 911" }).code).toBe(
      "674911",
    );
    expect(VerifyEmailCodeSchema.safeParse({ code: "12345" }).success).toBe(
      false,
    );
  });

  it("need a branch for an admin", () => {
    expect(
      AddAdminSchema.safeParse({
        intent: "add-admin",
        email: "a@b.co",
        branchIds: [],
      }).success,
    ).toBe(false);
    expect(
      AddAdminSchema.safeParse({
        intent: "add-admin",
        email: "a@b.co",
        branchIds: [ID],
      }).success,
    ).toBe(true);
  });

  it("tell inline actions apart by intent", () => {
    expect(
      StudentActionSchema.parse({
        intent: "move-student",
        linkId: ID,
        branchId: ID,
      }).intent,
    ).toBe("move-student");
    expect(
      StudentActionSchema.safeParse({ intent: "explode", linkId: ID }).success,
    ).toBe(false);
  });

  it("check a school's short name", () => {
    const base = {
      intent: "create-school",
      name: "Rafiki School",
      ownerEmail: "o@r.co",
    } as const;
    expect(
      CreateSchoolSchema.safeParse({ ...base, slug: "Rafiki School" }).success,
    ).toBe(false);
    expect(CreateSchoolSchema.parse({ ...base, slug: "Rafiki" }).slug).toBe(
      "rafiki",
    );
  });

  it("never explain with an em dash", () => {
    const issues =
      EmailCodeRequestSchema.safeParse({ email: "x" }).error?.issues ?? [];
    for (const issue of issues) expect(issue.message).not.toContain("—");
  });
});
