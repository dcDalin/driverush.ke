/**
 * Weekly PostHog summary, posted to Discord.
 *
 * PostHog can only send scheduled dashboards to email, Slack or Teams, so this
 * does it for Discord: it reads the last 7 days of production traffic (and the
 * 7 before, for comparison) and posts one message with links to the four
 * dashboards. Run weekly by `.github/workflows/weekly-summary.yml`.
 *
 *   DISCORD_WEBHOOK_URL  where to post (required unless --print)
 *   POSTHOG_API_KEY      personal API key with "query: read". Without it the
 *                        script asks the local `posthog-cli` (after
 *                        `npx posthog-cli login`), which is handy for testing.
 *
 *   node scripts/weekly-summary.mjs           post to Discord
 *   node scripts/weekly-summary.mjs --print   print the message, post nothing
 */
import { spawnSync } from "node:child_process";

const PROJECT_ID = 755646;
const POSTHOG = "https://us.posthog.com";
const DASHBOARDS = [
  ["Weekly health", 2391457],
  ["Growth and content", 2391459],
  ["Board on real phones", 2391460],
  ["Board course", 2391145],
  ["Learners", 2391147],
  ["Road signs", 2391150],
  ["Site health", 2391155],
];
const RUSH = 0xe11d2e;
const PRINT = process.argv.includes("--print");

const DAY = 24 * 60 * 60 * 1000;
const end = new Date();
const mid = new Date(end.getTime() - 7 * DAY);
const start = new Date(end.getTime() - 14 * DAY);
const ts = (d) => d.toISOString().slice(0, 19).replace("T", " ");

/**
 * Production humans only: dev traffic is tagged `app_env = development`, and
 * `$virt_is_bot` drops bots, including the project's custom bot rules (cloud
 * browsers from DigitalOcean and Tencent Cloud that pose as normal Chrome).
 */
const PROD =
  "properties.app_env = 'production' AND NOT properties.$virt_is_bot";
const THIS_WEEK = `timestamp >= toDateTime('${ts(mid)}') AND timestamp < toDateTime('${ts(end)}')`;

// ----- running a query -----

async function sql(query) {
  return process.env.POSTHOG_API_KEY ? viaApi(query) : viaCli(query);
}

async function viaApi(query) {
  const res = await fetch(`${POSTHOG}/api/projects/${PROJECT_ID}/query/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.POSTHOG_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
  });
  if (!res.ok) {
    throw new Error(`PostHog query failed: ${res.status} ${await res.text()}`);
  }
  const body = await res.json();
  return body.results.map((row) =>
    Object.fromEntries(body.columns.map((c, i) => [c, row[i]])),
  );
}

/** The CLI prints a `a|b|c` table, sometimes after a block of warnings. */
function viaCli(query) {
  const r = spawnSync(
    "npx",
    [
      "posthog-cli",
      "api",
      "call",
      "--json",
      "execute-sql",
      JSON.stringify({ query }),
    ],
    { encoding: "utf8", maxBuffer: 16 << 20 },
  );
  const out = r.stdout ?? "";
  if (r.status !== 0) throw new Error(`posthog-cli failed:\n${out}${r.stderr}`);
  const text = String(JSON.parse(out.slice(out.indexOf("{"))).results ?? "");
  const lines = text
    .replace(/<taxonomy_warnings>[\s\S]*?<\/taxonomy_warnings>/, "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.includes("|"));
  if (!lines.length) return [];
  const [head, ...rows] = lines.map((l) => l.split("|"));
  return rows.map((cells) =>
    Object.fromEntries(
      head.map((h, i) => [h, cells[i] === "(null)" ? null : cells[i]]),
    ),
  );
}

// ----- the numbers -----

const totals = sql(`
  SELECT
    if(timestamp >= toDateTime('${ts(mid)}'), 'now', 'prev') AS w,
    uniqIf(person_id, event = '$pageview') AS visitors,
    uniqIf(person_id, event IN ('board_level_completed', 'board_challenge_passed', 'pelican_completed', 'signs3d_completed', 'sign_check_completed')) AS active_learners,
    uniqIf(person_id, (event = 'board_level_completed' AND toFloat(properties.number) >= 3) OR event IN ('pelican_completed', 'signs3d_completed')) AS activated,
    uniqIf(person_id, event = 'test_result_reported' AND properties.result IN ('passed', 'failed')) AS tests_reported,
    uniqIf(person_id, event = 'test_result_reported' AND properties.result = 'passed') AS tests_passed,
    uniqIf(person_id, event = 'board_level_started') AS board_learners,
    uniqIf(person_id, event = 'board_level_completed' AND toString(properties.number) = '1') AS first_drives,
    countIf(event = 'board_level_completed') AS levels_done,
    uniqIf(person_id, event IN ('pelican_started', 'signs3d_started')) AS sign_learners,
    countIf(event = 'app_installed') AS installs,
    countIf(event = 'share_completed') AS shares,
    countIf(event = '$exception') AS errors,
    uniqIf(person_id, event = '$exception') AS error_learners,
    quantileIf(0.75)(toFloat(properties.$web_vitals_LCP_value), event = '$web_vitals') AS lcp_p75
  FROM events
  WHERE ${PROD}
    AND timestamp >= toDateTime('${ts(start)}') AND timestamp < toDateTime('${ts(end)}')
  GROUP BY w`);

const top = (event, key, extra = "") =>
  sql(`
    SELECT toString(${key}) AS k, count() AS n
    FROM events
    WHERE ${PROD} AND ${THIS_WEEK} AND event = '${event}' ${extra}
      AND ${key} IS NOT NULL
    GROUP BY k ORDER BY n DESC LIMIT 3`);

const stops = sql(`
  SELECT toString(properties.number) AS k,
    uniqIf(person_id, event = 'board_level_started')
      - uniqIf(person_id, event = 'board_level_completed') AS n
  FROM events
  WHERE ${PROD} AND ${THIS_WEEK}
    AND event IN ('board_level_started', 'board_level_completed')
    AND properties.number IS NOT NULL
  GROUP BY k HAVING n > 0 ORDER BY n DESC LIMIT 3`);

const sources = sql(`
  SELECT toString(properties.$referring_domain) AS k, uniq(person_id) AS n
  FROM events
  WHERE ${PROD} AND ${THIS_WEEK} AND event = '$pageview'
  GROUP BY k ORDER BY n DESC LIMIT 3`);

const [rows, abandoned, faults, missed, errorPages, stopRows, sourceRows] =
  await Promise.all([
    totals,
    top("board_abandoned", "properties.challenge_id"),
    top("board_faulted", "properties.rule"),
    top(
      "sign_graded",
      "properties.sign_code",
      "AND properties.result = 'missed'",
    ),
    top("$exception", "properties.$pathname"),
    stops,
    sources,
  ]);

// ----- the message -----

const now = rows.find((r) => r.w === "now") ?? {};
const prev = rows.find((r) => r.w === "prev") ?? {};
const num = (v) => (v == null || Number.isNaN(Number(v)) ? 0 : Number(v));

function stat(key) {
  const a = num(now[key]);
  const b = num(prev[key]);
  let change = "";
  if (b === 0 && a > 0) change = " (new)";
  else if (b > 0) {
    const pct = Math.round(((a - b) / b) * 100);
    change =
      pct === 0 ? " (same)" : ` (${pct > 0 ? "▲" : "▼"} ${Math.abs(pct)}%)`;
  }
  return `**${a.toLocaleString("en-KE")}**${change}`;
}

function list(rows, label = (k) => k) {
  if (!rows.length) return "Nothing this week";
  return rows
    .map(
      (r, i) => `${i + 1}. ${label(r.k)}: ${num(r.n).toLocaleString("en-KE")}`,
    )
    .join("\n");
}

const day = (d) =>
  d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "Africa/Nairobi",
  });
const lcp = num(now.lcp_p75);
const firstDriveRate =
  num(now.visitors) > 0
    ? ` (${Math.round((num(now.first_drives) / num(now.visitors)) * 100)}% of visitors)`
    : "";

const pct = (part, whole) =>
  num(whole) > 0 ? ` (${Math.round((num(part) / num(whole)) * 100)}%)` : "";

const embed = {
  title: "DriveRush weekly summary",
  description: `${day(mid)} to ${day(end)}, live site, bots removed. Changes compare with the 7 days before.`,
  color: RUSH,
  fields: [
    { name: "Visitors", value: stat("visitors"), inline: true },
    {
      name: "Active learners",
      value: stat("active_learners"),
      inline: true,
    },
    {
      name: "Reached activation",
      value:
        stat("activated") +
        (num(now.visitors) > 0
          ? `, ${Math.round((num(now.activated) / num(now.visitors)) * 100)}% of visitors`
          : ""),
      inline: true,
    },
    {
      name: "Learners on the board",
      value: stat("board_learners"),
      inline: true,
    },
    {
      name: "Finished level 1",
      value: stat("first_drives") + firstDriveRate,
      inline: true,
    },
    { name: "Levels finished", value: stat("levels_done"), inline: true },
    {
      name: "Learners on sign trainers",
      value: stat("sign_learners"),
      inline: true,
    },
    {
      name: "NTSA tests passed",
      value: num(now.tests_reported)
        ? `**${num(now.tests_passed)}** of ${num(now.tests_reported)} who told us${pct(now.tests_passed, now.tests_reported)}`
        : "Nobody told us this week",
      inline: true,
    },
    {
      name: "Installs / shares",
      value: `${stat("installs")} / ${stat("shares")}`,
      inline: true,
    },
    {
      name: "Levels where most learners stop",
      value: list(stopRows, (k) => `Level ${k}`),
      inline: true,
    },
    { name: "Most abandoned tasks", value: list(abandoned), inline: true },
    { name: "Most common mistakes", value: list(faults), inline: true },
    { name: "Most-missed signs", value: list(missed), inline: true },
    {
      name: "Top sources",
      value: list(sourceRows, (k) => (!k || k === "$direct" ? "direct" : k)),
      inline: true,
    },
    {
      name: "Site health",
      value: [
        `Errors: ${stat("errors")}, learners affected: ${stat("error_learners")}`,
        `Page load (LCP p75): ${lcp ? `${(lcp / 1000).toFixed(1)} s` : "no data"}`,
        errorPages.length
          ? `Worst page: ${errorPages[0].k} (${num(errorPages[0].n)} errors)`
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
      inline: false,
    },
    {
      name: "Dashboards",
      value: DASHBOARDS.map(
        ([name, id]) =>
          `[${name}](${POSTHOG}/project/${PROJECT_ID}/dashboard/${id})`,
      ).join(" · "),
      inline: false,
    },
  ],
};

if (PRINT) {
  console.log(JSON.stringify(embed, null, 2));
  process.exit(0);
}

const hook = process.env.DISCORD_WEBHOOK_URL;
if (!hook) throw new Error("DISCORD_WEBHOOK_URL is not set (or pass --print)");
const res = await fetch(hook, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ embeds: [embed], allowed_mentions: { parse: [] } }),
});
if (!res.ok) throw new Error(`Discord said ${res.status}: ${await res.text()}`);
console.log("Posted the weekly summary to Discord");
