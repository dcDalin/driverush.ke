/**
 * Is this request a bot? Decided on the server, from the request alone, so
 * Google Analytics is never loaded for one. GA4 drops only the bots on
 * Google's own list. The ones that matter here are cloud browsers that look
 * like an ordinary Chrome on a phone and come from data centres, where no
 * learner sits.
 *
 * PostHog keeps capturing every request: its custom bot rules label the same
 * ranges as bots (`$virt_is_bot`), and its default filters leave them out.
 * **The ranges below must stay in step with those rules** (PostHog: Settings,
 * Environment, Custom bots; or `web-analytics-bot-rules-list`). See "Bot
 * filtering" in `docs/analytics.md`.
 */

/** Data-centre ranges that send browsers posing as learners. IPv4 CIDR. */
export const DATACENTER_RANGES: Record<string, readonly string[]> = {
  "Tencent Cloud crawler": [
    "43.128.0.0/11",
    "129.226.0.0/16",
    "154.8.128.0/17",
    "101.32.0.0/15",
    "119.28.0.0/15",
    "170.106.0.0/16",
  ],
  "DigitalOcean cloud browser": [
    "137.184.0.0/16",
    "143.110.0.0/16",
    "143.198.0.0/16",
    "146.190.0.0/16",
    "165.232.0.0/16",
    "209.38.0.0/16",
    "24.199.64.0/18",
    "64.23.128.0/17",
    "64.225.0.0/16",
    "64.227.0.0/16",
    "68.183.0.0/16",
    "104.248.0.0/16",
    "134.209.0.0/16",
    "138.68.0.0/16",
    "138.197.0.0/16",
    "142.93.0.0/16",
    "157.230.0.0/16",
    "159.65.0.0/16",
    "159.89.0.0/16",
    "159.203.0.0/16",
    "161.35.0.0/16",
    "164.90.0.0/16",
    "164.92.0.0/16",
    "165.22.0.0/16",
    "165.227.0.0/16",
    "167.71.0.0/16",
    "167.99.0.0/16",
    "167.172.0.0/16",
    "174.138.0.0/16",
    "178.128.0.0/16",
    "188.166.0.0/16",
    "206.189.0.0/16",
  ],
};

/** An IPv4 address as a number, or `null` for anything else (IPv6 too). */
function ipv4(value: string): number | null {
  const parts = value.trim().split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const byte = Number(part);
    if (byte > 255) return null;
    n = n * 256 + byte;
  }
  return n;
}

type Range = { base: number; size: number };

const RANGES: Range[] = Object.values(DATACENTER_RANGES)
  .flat()
  .map((cidr) => {
    const [address, bits] = cidr.split("/");
    const size = 2 ** (32 - Number(bits));
    const base = ipv4(address!)!;
    return { base: base - (base % size), size };
  });

/** The address is in one of {@link DATACENTER_RANGES}. */
export function isDatacenterIp(ip: string | null | undefined): boolean {
  if (!ip) return false;
  // `::ffff:1.2.3.4` is an IPv4 address written the IPv6 way.
  const n = ipv4(ip.replace(/^::ffff:/i, ""));
  if (n == null) return false;
  return RANGES.some((r) => n >= r.base && n < r.base + r.size);
}

/**
 * User agents that say they are a bot, a headless browser or a script. Real
 * browsers never carry these words. "Cubot" is a phone maker, not a bot.
 */
const BOT_UA =
  /(?<!cu)bot\b|bot\/|crawl|spider|slurp|scrap|headless|lighthouse|pagespeed|gtmetrix|pingdom|uptime|monitor|puppeteer|playwright|phantomjs|selenium|webdriver|python-|python\/|curl\/|wget\/|go-http-client|okhttp|axios\/|node-fetch|undici|java\/|libwww|httpclient|facebookexternalhit|ahrefs|semrush|mj12|bytespider|chatgpt|anthropic|perplexity|ccbot|bingpreview/i;

/** The user agent says it's automated, or there is none at all. */
export function isBotUserAgent(ua: string | null | undefined): boolean {
  if (!ua || !ua.trim()) return true;
  return BOT_UA.test(ua);
}

/** The address the request came from, as Vercel passes it on. */
export function clientIp(headers: Headers): string | null {
  const real = headers.get("x-real-ip");
  if (real) return real.trim();
  const forwarded = headers.get("x-forwarded-for");
  return forwarded ? forwarded.split(",")[0]!.trim() : null;
}

/** Whether Google Analytics should measure this request's page. */
export function shouldMeasure(request: Request): boolean {
  const { headers } = request;
  if (isBotUserAgent(headers.get("user-agent"))) return false;
  return !isDatacenterIp(clientIp(headers));
}
