import { describe, expect, it, vi } from "vitest";

import {
  adminEmail,
  bankDecisionEmail,
  ownerEmail,
  studentEmail,
} from "./messages";
import { sendEmail } from "./send.server";

describe("email messages", () => {
  it("tells an invited owner to sign in with this email", () => {
    const m = ownerEmail({
      school: "Heltz",
      result: "invited",
      origin: "https://driverush.ke",
    });
    expect(m.subject).toBe("You now run Heltz on DriveRush");
    expect(m.text).toContain("Sign in with this email address");
    expect(m.html).toContain('href="https://driverush.ke/school"');
  });

  it("names the branches an admin works in", () => {
    const m = adminEmail({
      school: "Heltz",
      branches: ["Nairobi CBD", "Westlands"],
      result: "added",
      origin: "http://localhost:5730",
    });
    expect(m.text).toContain("for Nairobi CBD, Westlands");
  });

  it("asks a waiting student to join", () => {
    const m = studentEmail({
      school: "Heltz",
      branch: "Westlands",
      started: false,
      origin: "https://driverush.ke",
    });
    expect(m.text).toContain("choose Join");
  });

  it("escapes school names in the HTML", () => {
    const m = bankDecisionEmail({
      school: "A&B <Drivers>",
      approved: false,
      bank: "Equity ••1",
      note: null,
      origin: "https://driverush.ke",
    });
    expect(m.html).toContain("A&amp;B &lt;Drivers&gt;");
    expect(m.html).not.toContain("<Drivers>");
  });

  it("has no em dashes (house rule)", () => {
    const all = [
      ownerEmail({ school: "S", result: "added", origin: "o" }),
      studentEmail({ school: "S", branch: null, started: true, origin: "o" }),
    ];
    for (const m of all) expect(m.text).not.toContain("—");
  });
});

describe("sendEmail", () => {
  const email = { to: "a@b.test", subject: "Hi", text: "t", html: "<p>t</p>" };

  it("sends through Resend when a key is set", async () => {
    const f = vi.fn(async () => new Response("{}", { status: 200 }));
    const r = await sendEmail(email, {
      source: { RESEND_API_KEY: "re_test1", EMAIL_FROM: "DR <x@y.test>" },
      fetchFn: f,
    });
    expect(r).toEqual({ sent: true, via: "resend" });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(JSON.parse(String(init.body))).toMatchObject({
      from: "DR <x@y.test>",
      to: ["a@b.test"],
    });
  });

  it("sends to the local Mailpit without a key", async () => {
    const f = vi.fn(async () => new Response("{}", { status: 200 }));
    const r = await sendEmail(email, {
      source: { MAILPIT_URL: "http://127.0.0.1:54724" },
      fetchFn: f,
    });
    expect(r.via).toBe("mailpit");
    expect((f.mock.calls[0] as unknown as [string])[0]).toBe(
      "http://127.0.0.1:54724/api/v1/send",
    );
  });

  it("never throws when sending fails", async () => {
    const f = vi.fn(async () => new Response("no", { status: 500 }));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await sendEmail(email, {
      source: { RESEND_API_KEY: "re_test1" },
      fetchFn: f,
    });
    expect(r.sent).toBe(false);
    spy.mockRestore();
  });

  it("sends nothing with no settings", async () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    const r = await sendEmail(email, { source: {} });
    expect(r).toEqual({ sent: false, via: "none" });
    spy.mockRestore();
  });
});
