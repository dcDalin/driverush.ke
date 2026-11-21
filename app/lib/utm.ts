/**
 * UTM plumbing: one place for the campaign vocabulary and link tagging.
 *
 * `addUtm(url, params)` appends `utm_*` query keys to a link we ship out
 * (partner cards, share buttons, the /tools/share builder). Inbound, GA4 and
 * PostHog both read `utm_*` off the landing URL themselves and attribute the
 * whole session to it, so nothing here needs to store them.
 */

/** Canonical channel presets. Pairs of source+medium that match GA4 defaults. */
export const UTM_CHANNELS = {
  twitter: { source: "twitter", medium: "social" },
  instagram: { source: "instagram", medium: "social" },
  facebook: { source: "facebook", medium: "social" },
  tiktok: { source: "tiktok", medium: "social" },
  whatsapp: { source: "whatsapp", medium: "social" },
  telegram: { source: "telegram", medium: "social" },
  linkedin: { source: "linkedin", medium: "social" },
  youtube: { source: "youtube", medium: "social" },
  email: { source: "email", medium: "email" },
  partner: { source: "partner", medium: "referral" },
  press: { source: "press", medium: "referral" },
  qr: { source: "qr", medium: "offline" },
  paid_search: { source: "google", medium: "cpc" },
  paid_social: { source: "meta", medium: "paidsocial" },
} as const;

export type UtmChannel = keyof typeof UTM_CHANNELS;

/** Campaign names we use across links. Free-form strings work too, but lean on
 *  these so reports don't fragment from typos (`launch` vs `Launch`). */
export const UTM_CAMPAIGNS = [
  "launch",
  "road_signs_trainer",
  "free_practice",
  "ntsa_prep",
  "partner_share",
  "social_organic",
] as const;

export type UtmCampaign = (typeof UTM_CAMPAIGNS)[number];

export type UtmParams = {
  source: string;
  medium: string;
  campaign?: string;
  term?: string;
  content?: string;
};

const UTM_KEYS = ["source", "medium", "campaign", "term", "content"] as const;

/** Build a tagged URL. Returns the original string if `url` won't parse. */
export function addUtm(url: string, params: UtmParams): string {
  try {
    // Second arg lets us parse relative paths (e.g. `/practice`) the same way.
    const u = new URL(url, "https://driverush.ke");
    for (const k of UTM_KEYS) {
      const v = params[k];
      if (v) u.searchParams.set(`utm_${k}`, v);
    }
    return u.toString();
  } catch {
    return url;
  }
}

/** Slugify a free-text label into something safe for utm_campaign. */
export function utmSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}
