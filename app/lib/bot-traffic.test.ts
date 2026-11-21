import { describe, expect, it } from "vitest";

import {
  clientIp,
  DATACENTER_RANGES,
  isBotUserAgent,
  isDatacenterIp,
  shouldMeasure,
} from "./bot-traffic";

const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";
const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const CUBOT =
  "Mozilla/5.0 (Linux; Android 11; CUBOT X30) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

describe("isDatacenterIp", () => {
  it("matches the first and last address of a range, not the next", () => {
    expect(isDatacenterIp("137.184.0.0")).toBe(true);
    expect(isDatacenterIp("137.184.255.255")).toBe(true);
    expect(isDatacenterIp("137.185.0.0")).toBe(false);
    expect(isDatacenterIp("137.183.255.255")).toBe(false);
  });

  it("handles ranges wider and narrower than /16", () => {
    // 43.128.0.0/11 runs to 43.159.255.255.
    expect(isDatacenterIp("43.159.255.255")).toBe(true);
    expect(isDatacenterIp("43.160.0.0")).toBe(false);
    // 24.199.64.0/18 runs to 24.199.127.255.
    expect(isDatacenterIp("24.199.127.255")).toBe(true);
    expect(isDatacenterIp("24.199.128.0")).toBe(false);
  });

  it("reads IPv4 written the IPv6 way, and leaves real IPv6 and junk alone", () => {
    expect(isDatacenterIp("::ffff:137.184.10.10")).toBe(true);
    expect(isDatacenterIp("2c0f:fe38:2001::1")).toBe(false);
    expect(isDatacenterIp("not an ip")).toBe(false);
    expect(isDatacenterIp("999.1.1.1")).toBe(false);
    expect(isDatacenterIp(null)).toBe(false);
  });

  it("keeps a Kenyan mobile address measured", () => {
    // Safaricom.
    expect(isDatacenterIp("105.160.1.1")).toBe(false);
  });

  it("has every range written as a valid CIDR", () => {
    for (const cidr of Object.values(DATACENTER_RANGES).flat()) {
      expect(cidr).toMatch(/^\d{1,3}(\.\d{1,3}){3}\/\d{1,2}$/);
    }
  });
});

describe("isBotUserAgent", () => {
  it("lets real phones through", () => {
    expect(isBotUserAgent(ANDROID_CHROME)).toBe(false);
    expect(isBotUserAgent(IPHONE_SAFARI)).toBe(false);
    expect(isBotUserAgent(CUBOT)).toBe(false);
  });

  it("catches crawlers, headless browsers and scripts", () => {
    for (const ua of [
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/131.0.0.0 Safari/537.36",
      "curl/8.4.0",
      "python-requests/2.31.0",
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)",
      "Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)",
      "Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Mobile Safari/537.36 Chrome-Lighthouse",
    ]) {
      expect(isBotUserAgent(ua), ua).toBe(true);
    }
  });

  it("counts a missing user agent as a bot", () => {
    expect(isBotUserAgent("")).toBe(true);
    expect(isBotUserAgent(null)).toBe(true);
  });
});

describe("shouldMeasure", () => {
  const request = (headers: Record<string, string>) =>
    new Request("https://driverush.ke/", { headers });

  it("takes the first address of x-forwarded-for when x-real-ip is missing", () => {
    expect(
      clientIp(new Headers({ "x-forwarded-for": "137.184.10.10, 10.0.0.1" })),
    ).toBe("137.184.10.10");
    expect(
      clientIp(
        new Headers({
          "x-real-ip": "105.160.1.1",
          "x-forwarded-for": "1.1.1.1",
        }),
      ),
    ).toBe("105.160.1.1");
  });

  it("measures a learner and skips bots and cloud browsers", () => {
    expect(
      shouldMeasure(
        request({ "user-agent": ANDROID_CHROME, "x-real-ip": "105.160.1.1" }),
      ),
    ).toBe(true);
    expect(shouldMeasure(request({ "user-agent": ANDROID_CHROME }))).toBe(true);
    expect(
      shouldMeasure(
        request({
          "user-agent": ANDROID_CHROME,
          "x-forwarded-for": "137.184.10.10",
        }),
      ),
    ).toBe(false);
    expect(shouldMeasure(request({ "user-agent": "curl/8.4.0" }))).toBe(false);
  });
});
