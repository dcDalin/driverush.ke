/**
 * Google Analytics 4, with no library: the gtag snippet is ours, so every
 * setting that decides whether the numbers are right is in this file.
 *
 * How a visit is measured:
 *
 *  1. {@link gaHeadScript} runs in `<head>`, before React. It decides whether
 *     this browser is measured at all, sets consent, configures the stream
 *     and sends the landing page view itself. A learner on a slow phone who
 *     leaves before the app's JavaScript runs is still counted.
 *  2. Every navigation after that is sent by `usePageviews()` in
 *     `analytics.ts`, through {@link gaPageView}.
 *  3. Events go through {@link gaEvent}, trimmed to GA4's limits.
 *
 * Which GA property gets the hits is set per environment, by
 * `VITE_PUBLIC_GA_MEASUREMENT_ID`: the production property on Vercel's
 * Production environment, the separate dev property on Preview, Development
 * and local `.env`. Unset, nothing loads at all. Dev and preview traffic so
 * never reaches the production numbers.
 *
 * Never measured on `/tools`, or in a browser driven by a script (the promo
 * video recorder). Outside a production build every hit is in debug mode, so
 * it shows in the dev property's DebugView. Two switches, both sticky:
 *
 *  - `?ga_debug=1` puts a production tab in debug mode too, for DebugView
 *    (`?ga_debug=0` stops). Kept for the tab.
 *  - `?internal=1` marks this browser as ours: hits carry
 *    `traffic_type=internal`, which the GA internal-traffic filter drops
 *    (`?internal=0` clears it). Kept on the device.
 *
 * Consent: no banner. There are no ads, so analytics storage is granted and
 * every advertising signal is denied, and Google signals are off.
 */
import type { PageMeta } from "./page-meta";

/** This environment's GA property. `undefined` turns GA off. */
export const GA_MEASUREMENT_ID: string | undefined =
  import.meta.env.VITE_PUBLIC_GA_MEASUREMENT_ID || undefined;

/** Development and `vite preview` builds: every hit goes to DebugView. */
const ALWAYS_DEBUG = !import.meta.env.PROD;
const DEBUG_KEY = "dr:ga_debug";
const INTERNAL_KEY = "dr:internal";

/** The landing page, worked out on the server for the head script. */
export type GaLanding = PageMeta & {
  /** `pathname + search` with only the keys worth reporting (`cleanPath`). */
  path: string;
};

/**
 * The inline `<head>` script. Put it after `<Meta />` so `document.title` is
 * already the page's own. Everything is in one try: analytics must never
 * break a page.
 */
export function gaHeadScript(
  landing: GaLanding,
  measurementId: string | undefined = GA_MEASUREMENT_ID,
): string {
  if (!measurementId) return "";
  // `<` escaped so a path can't close the script tag.
  const page = JSON.stringify(landing).replace(/</g, "\\u003c");
  return `(function(){try{
var P=${page},I=${JSON.stringify(measurementId)},w=window,l=location,d=document;
var q=new URLSearchParams(l.search),s=sessionStorage,ls=localStorage;
var g=q.get('ga_debug');if(g==='1')s.setItem('${DEBUG_KEY}','1');else if(g==='0')s.removeItem('${DEBUG_KEY}');
var n=q.get('internal');if(n==='1')ls.setItem('${INTERNAL_KEY}','1');else if(n==='0')ls.removeItem('${INTERNAL_KEY}');
var dbg=${ALWAYS_DEBUG}||s.getItem('${DEBUG_KEY}')==='1';
if(navigator.webdriver)return;
if(/^\\/tools(\\/|$)/.test(l.pathname))return;
w.dataLayer=w.dataLayer||[];
function gtag(){w.dataLayer.push(arguments);}
w.gtag=gtag;w.__drGa={debug:dbg,page:{content_group:P.content_group,page_template:P.page_template}};
gtag('consent','default',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
gtag('js',new Date());
var c={send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false};
if(dbg)c.debug_mode=true;
gtag('config',I,c);
gtag('set','user_properties',{display_mode:(matchMedia('(display-mode: standalone)').matches||navigator.standalone===true)?'standalone':'browser'});
if(ls.getItem('${INTERNAL_KEY}')==='1')gtag('set',{traffic_type:'internal'});
var v={page_location:l.origin+P.path,page_title:d.title,page_referrer:d.referrer,content_group:P.content_group,page_template:P.page_template};
gtag('set',{page_location:v.page_location,page_title:v.page_title,page_referrer:v.page_referrer});gtag('event','page_view',v);
if(P.content_group==='Not found')gtag('event','page_not_found',{missing_path:l.pathname});
var e=d.createElement('script');e.async=true;e.src='https://www.googletagmanager.com/gtag/js?id='+I;d.head.appendChild(e);
}catch(e){}})();`;
}

type Gtag = (...args: unknown[]) => void;

/** Set by the head script when this browser is measured. */
type GaState = { debug: boolean; page: PageMeta };

function state(): GaState | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { __drGa?: GaState }).__drGa;
}

/** The gtag function, when the head script decided to measure this browser. */
function gtag(): Gtag | undefined {
  if (typeof window === "undefined" || !state()) return undefined;
  const g = (window as Window & { gtag?: Gtag }).gtag;
  return typeof g === "function" ? g : undefined;
}

export function gaActive(): boolean {
  return gtag() !== undefined;
}

export type GaParams = Record<string, string | number | boolean | undefined>;

/**
 * GA4's limits: names up to 40 characters, 25 parameters an event, text values
 * up to 100 characters. Over that, GA drops the value or the whole event
 * without a word, so trim here instead.
 */
export function sanitizeGaParams(
  params: Record<string, unknown> | undefined,
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  if (!params) return out;
  let count = 0;
  for (const [rawKey, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (count >= 25) break;
    const key = rawKey.slice(0, 40);
    if (typeof value === "number") {
      if (!Number.isFinite(value)) continue;
      out[key] = value;
    } else if (typeof value === "boolean") {
      out[key] = value;
    } else {
      out[key] = String(value).slice(0, 100);
    }
    count += 1;
  }
  return out;
}

/**
 * Send one event. No-op when this browser isn't measured. It carries the
 * page's content group and template, so events can be split by page type:
 * gtag's `set` does not pass custom parameters on to later events.
 */
export function gaEvent(name: string, params?: Record<string, unknown>) {
  gtag()?.(
    "event",
    name.slice(0, 40),
    sanitizeGaParams({ ...state()?.page, ...params }),
  );
}

/**
 * A page view after an in-app navigation. The URL, title and referrer are
 * also `set`, so every event that follows is reported against this page.
 */
export function gaPageView(page: {
  page_location: string;
  page_referrer: string;
  page_title: string;
  content_group: string;
  page_template: string;
}) {
  const g = gtag();
  const ga = state();
  if (!g || !ga) return;
  ga.page = {
    content_group: page.content_group,
    page_template: page.page_template,
  };
  const params = sanitizeGaParams(page);
  // URLs may run past 100 characters; GA allows 1,000 for these two.
  params.page_location = page.page_location.slice(0, 1000);
  params.page_referrer = page.page_referrer.slice(0, 1000);
  g("set", {
    page_location: params.page_location,
    page_referrer: params.page_referrer,
    page_title: params.page_title,
  });
  g("event", "page_view", params);
}

/** User properties: a few low-cardinality buckets about the learner. */
export function gaSetUserProperties(props: GaParams) {
  gtag()?.("set", "user_properties", sanitizeGaParams(props));
}
