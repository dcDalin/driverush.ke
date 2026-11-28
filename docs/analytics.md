# DriveRush Analytics (PostHog)

**Audience:** whoever is looking at the numbers, and engineers adding events.

**Status:** active. PostHog is the system of record for product analytics; GA4
runs alongside it for traffic, acquisition and search reports (see
[Google Analytics 4](#google-analytics-4)). There are no user accounts yet,
so every learner is anonymous — person profiles carry the learner state instead
(see [Learner profile](#learner-profile)).

---

## Table of contents

1. [How it's wired](#how-its-wired)
2. [What comes for free](#what-comes-for-free)
3. [Event taxonomy](#event-taxonomy)
4. [Learner profile](#learner-profile)
5. [Dashboards, actions, cohorts and surveys](#dashboards-actions-cohorts-and-surveys)
6. [Bot filtering](#bot-filtering)
7. [Adding an event](#adding-an-event)
8. [Local development](#local-development)
9. [Known gaps](#known-gaps)
10. [Google Analytics 4](#google-analytics-4)

---

## How it's wired

| Piece                     | File                                                    | Notes                                                                                                                                                                 |
| ------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Client init + config      | `app/lib/posthog.ts`                                    | One start, one accessor. posthog-js loads by dynamic import; `withPostHog(fn)` runs now or queues until it has loaded. Missing env = no-op in prod, loud in dev.      |
| Start                     | `app/entry.client.tsx`                                  | `startPostHog()` runs alongside hydration and never blocks it (owner, 2026-11-28): the page is interactive sooner on cheap phones; PostHog starts a moment later.     |
| Typed event dispatcher    | `app/lib/analytics.ts`                                  | One method per event. Also mirrors to GA4 and console-logs in dev.                                                                                                    |
| Learner person properties | `app/lib/use-learner-analytics.ts`                      | Syncs localStorage progress → PostHog person properties. Mounted in `app/root.tsx`.                                                                                   |
| Error capture             | `app/root.tsx` (`ErrorBoundary`) + `capture_exceptions` | React render errors, uncaught errors, unhandled rejections.                                                                                                           |
| SSR bundling              | `vite.config.ts` (`ssr.noExternal`)                     | Keeps the browser-only SDK out of Node's resolver.                                                                                                                    |
| Ad-blocker proxy          | `vercel.json` (`rewrites`) + `api_host: "/ingest"`      | Production sends events to `driverush.ke/ingest/*`, rewritten to PostHog. Dev talks to PostHog directly. A host without these rewrites (the Dockerfile) loses events. |
| Release tag               | `vite.config.ts` (`VITE_APP_VERSION`)                   | Short commit SHA from `VERCEL_GIT_COMMIT_SHA`, registered as `app_version` on every event.                                                                            |
| Readable stack traces     | `scripts/upload-sourcemaps.mjs` (runs after `build`)    | Uploads client source maps to error tracking, then deletes them. Off until `POSTHOG_CLI_API_KEY` is set.                                                              |

Environment (`.env`, and whatever hosts production):

```
VITE_PUBLIC_POSTHOG_PROJECT_TOKEN=phc_…
VITE_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

Build-time only, on Vercel, for source maps (never in `.env`, never `VITE_`):

```
POSTHOG_CLI_API_KEY=phx_…      personal API key, scope "error tracking: write"
POSTHOG_CLI_PROJECT_ID=12345   the number in the project's URL
```

## What comes for free

Configured in `app/lib/posthog.ts`, no call sites needed:

- `$pageview` / `$pageleave` on SPA navigation (`defaults: '2026-01-30'` → `history_change`)
- `$autocapture` — clicks, form interactions, so every link and button is already measurable
- `$rageclick` and `$dead_click` — where the UI looks tappable and isn't
- `$web_vitals` — LCP/CLS/INP per route
- `$exception` — uncaught errors and unhandled rejections
- Session replay and heatmaps (both must also be enabled in PostHog project settings)

Two filters are applied at the source:

- `/tools/*` and `/design` traffic is dropped in `before_send` — internal surfaces never inflate funnels.
- Every event carries `app_env` (`production` | `development`), so localhost can be excluded with one filter.

Every event also carries `app_version` (the deploy's commit), `display_mode`
(`standalone` when opened from the home screen) and `learner_stage`, plus:

- `content_group` and `page_template`: the page's type, the same labels GA
  gets ("Board game", "Sign page"). Added in `before_send` from the URL path
  (`pageMetaForPath` in `page-meta.ts`), because PostHog sends its page view
  as the URL changes, before React has drawn the new page. A test keeps the
  path labels in step with `routes.ts`.
- `connection` (`4g`, `3g`, `2g`, `slow-2g`, `unknown` on Safari) and
  `save_data`: what the browser says about the learner's connection.
- `arrived_via_share`: set once, for good, when a valid shared link (`/s`) is
  opened, to the kind of share (`board`, `pelican`, `signs3d`, `milestone`). Everything that
  visitor does later can be tied back to the share.

## Event taxonomy

All custom events are declared in `app/lib/analytics.ts`. Adding one anywhere
else is a bug — the file _is_ the taxonomy.

### Top of funnel

| Event                     | Fires when                                  | Key properties                                     |
| ------------------------- | ------------------------------------------- | -------------------------------------------------- |
| `sign_challenge_started`  | Homepage sign check shows a question        | `sign_id`, `category`                              |
| `sign_challenge_answered` | Visitor picks an option in the sign check   | `correct`, `question_index`, `sign_id`, `category` |
| `sign_check_completed`    | Visitor reaches the sign check's score card | `correct`, `total`                                 |

### Sign trainers

| Event                                     | Fires when                      | Key properties                                                                                                         |
| ----------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `pelican_started` / `signs3d_started`     | A run starts                    | `signs_total`, `categories`, `scope` (`round`/`chart`/`drill`)                                                         |
| `pelican_completed` / `signs3d_completed` | A run finishes                  | `scope`, `self_graded`, `signs_total`; when self-graded also `knew_first_try`, `miss_count`                            |
| `sign_graded`                             | "Knew it" or "Missed it" tapped | `trainer`, `sign_code`, `category`, `result`, `box_before`, `box_after`, `first_try`, `scope`                          |
| `signs3d_load_failed`                     | A 3D sign file fails both asks  | `reason` (`model`: "Try again" shown; `logo`: sign shown without the sticker; `download`: the trainer's code), `model` |

Before 25 Nov 2026 these failures reached the root error page as `$exception`
("Could not load …glb" / "pelican-signs-logo.jpg: undefined") and took the
trainer down. Most `logo` failures are bots that block images.

`sign_graded` by `sign_code` where `result = missed` is the "which signs does Kenya
get wrong" report.

### Model Town Board

| Event                    | Fires when                                                               | Key properties                                                                                                              |
| ------------------------ | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `board_level_started`    | A course level opens, from the list or Continue                          | `level`, `number`, `kind`, `unit`                                                                                           |
| `board_level_completed`  | A level is read, watched or passed for the first time                    | `level`, `number`, `kind`, `unit`                                                                                           |
| `board_skip_ahead`       | A locked level is opened after the "Skip ahead?" ask                     | `to_level`, `next_level` (where Continue would go), `surface` (`levels_page`, `levels_sheet`)                               |
| `board_started`          | A round or drill starts. A round is the mock test                        | `challenges`, `scope`, `mock`                                                                                               |
| `board_faulted`          | The referee calls a mistake                                              | `challenge_id`, `rule`, `severity`, `fault_number`                                                                          |
| `board_challenge_passed` | A task is passed                                                         | `challenge_id`, `clean`, `faults`, `stars`, `seconds`, `tries`, `score`, `best`                                             |
| `board_challenge_missed` | Stopped in the box after leaving the route                               | `challenge_id`, `rule`, `tries`, `seconds`                                                                                  |
| `board_abandoned`        | Left a round before the end                                              | `challenge_id`, `phase`, `task`, `of`, `tries`, `moved`, `off_route`                                                        |
| `board_completed`        | A round finishes                                                         | `challenges`, `clean`, `fault_count`, `scope`, `mock`; for the mock also `best_before`, `new_best`                          |
| `board_hint_used`        | A hint is used on a task                                                 | `challenge_id`, `kind`                                                                                                      |
| `board_first_move`       | The stick is pushed for the first time on the first drive (PostHog only) | `challenge_id`, `ms` (from the stick coming alive), `input` (`touch`, `keys`), `nudged` (the stick had started showing how) |
| `board_learn_opened`     | Learn mode opens                                                         |                                                                                                                             |
| `board_lesson_viewed`    | A lesson route or board feature is looked at                             | `kind`, `lesson_id`                                                                                                         |
| `board_loaded`           | The 3D board is drawn (PostHog only)                                     | `ms` (from the viewer opening), `tier`, `start_rung`, `weak_gpu`                                                            |
| `board_load_failed`      | The board can't be shown as it should                                    | `reason` (`no_webgl`, `download`, `models`), `tier`                                                                         |
| `board_quality_dropped`  | A slow phone gives up a rung of picture (PostHog only)                   | `tier`, `from`, `to`                                                                                                        |
| `board_setting_changed`  | A setting is changed in the board's sheet (PostHog only)                 | `setting` (`assist`, `seat`, `quality`, `sound`, `car`), `value`                                                            |

### Driving schools

Six schools take turns on the board (Heltz, Top Gear, Blixen, AA, Petanns,
and Stega since 26 Nov 2026).
Since 22 Nov 2026 the school changes with every new task, and the game's
address carries it (`/model-town-board/play?…&school=<id>`), so break pages
down by `$pathname`, not `$current_url`.

| Event                  | Fires when                                                                                               | Key properties    |
| ---------------------- | -------------------------------------------------------------------------------------------------------- | ----------------- |
| `sponsor_shown`        | A school is on screen in one place, once per place per task (per visit before 22 Nov 2026; PostHog only) | `school`, `place` |
| `sponsor_link_clicked` | A learner taps through to a school's site                                                                | `school`, `place` |

`place` is one of `car`, `room`, `plate`, `board`, `loader`, `ready_card`,
`credit`, `showcase` (the opening turn round the car). While a school is
shown, every event also carries the super property `sponsor` (the school's
id), so drives, mistakes and passes can be counted per school. Events from
before 21 Nov 2026 13:20 UTC have no `sponsor`.

### The NTSA test

A small card (`test-card.tsx`) asks for the test date on the course page
(`board-levels.tsx`) and, once a visit, at the end of a level in the game
(`level-test-note.tsx`, in place of the install nudge). After 3 finished
levels it asks "When is your NTSA test?". From the day after that date it asks
"How did it go?". The rules are in `test-date.ts`: "Not now", "Not booked yet"
and "Not taken yet" each wait 14 days before asking again, and a passed or
failed answer ends it. The answer is stored on the device under
`driverush:test`. The privacy page says the date and result go to analytics.

A date buys a plan (`test-plan.ts`, since 24 Nov 2026): the levels left spread
over the days left, ready the day before, so many levels a day. It is said in
one line (`planLine`) under the home button, on the course page (whose "Today"
dots follow it) and at the end of every level: "Test in 12 days. 1 of 4 levels
today.", then "Today's 4 are done. See you tomorrow." Saving a date offers a
daily practice reminder in the learner's own calendar (`test-reminder.ts`):
19:00 Nairobi, from tomorrow to the day before the test, as a Google Calendar
link or an .ics file.

| Event                  | Fires when                                | Key properties                                                                                             |
| ---------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `test_card_shown`      | The card asks its question (PostHog only) | `stage` (`date`, `result`), `surface` (`course_page`, `level_done`)                                        |
| `test_date_set`        | A date is saved, or "Not booked yet"      | `booked`, `days_until`, `surface`                                                                          |
| `test_reminder_added`  | A calendar link is tapped after saving    | `calendar` (`google`, `ics`), `days_until`                                                                 |
| `test_result_reported` | How the test went                         | `result` (`passed`, `failed`, `not_yet`), `days_after_test`, `levels_done`, `readiness`, `mock_best_clean` |
| `test_card_dismissed`  | "Not now" (PostHog only)                  | `stage`                                                                                                    |

### Today's drive

One driving task a day, the same for every learner in Kenya (`daily-drive.ts`:
the day is Nairobi's, the tasks come round in a fixed shuffled order, every
one before any repeats). It opens as `/model-town-board/play?task=<id>&daily=1`
from a row under the home page's Continue button and under the Board page's
course card (`daily-drive-row.tsx`), and from a quiet link at the end of a
level while it is still to do. Its pass card says "Today's drive is done. Day
N in a row. See you tomorrow." and leads on to the course. Any practice keeps
the streak (`practice-streak.ts`), as before; today's drive is the quickest.
A daily link opened on another day is an ordinary drive of that task.

| Event                 | Fires when                              | Key properties                                                                                |
| --------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------- |
| `daily_drive_opened`  | A "Today's drive" row or link is tapped | `challenge_id`, `surface` (`home`, `course_page`, `level_done`, `level_passed`), `done_today` |
| `daily_drive_started` | The game opens on today's drive         | `challenge_id`                                                                                |
| `daily_drive_passed`  | Today's drive is passed                 | `challenge_id`, `clean`, `stars`, `tries`, `streak_days` (counting today)                     |

`board_faulted` broken down by `rule` is the "which rules trip people up"
report; `board_level_started` → `board_level_completed` by `number` shows the
level where the course loses people.

### Navigation, sharing, installing

| Event                     | Fires when                                                      | Key properties                                       |
| ------------------------- | --------------------------------------------------------------- | ---------------------------------------------------- |
| `nav_tab_clicked`         | A bottom-bar tab is tapped                                      | `tab`, `from`                                        |
| `share_opened`            | Share is tapped, before a channel is picked                     | `kind`, `surface`                                    |
| `share_completed`         | A share is sent                                                 | `kind`, `channel`                                    |
| `share_landing_viewed`    | Someone opens a shared link                                     | `kind`, `valid`                                      |
| `proud_share_shown`       | A proud moment is offered for sharing, once ever (PostHog only) | `moment` (`unit`, `course`, `streak`, `passed`), `n` |
| `install_prompt_shown`    | The add-to-home-screen card appears                             | `platform`, `surface`                                |
| `install_prompt_answered` | It is answered                                                  | `platform`, `surface`, `outcome`                     |
| `app_installed`           | The browser reports an install                                  |                                                      |

**Proud moments** (since 24 Nov 2026, `proud-moments.ts`, `proud-share.tsx`):
finishing a unit or the whole course, a practice streak of 3, 7, 14, 30, 60 or
100 days, and "I passed" on the test card each offer a share card once, ever
(kept on the device under `driverush:proud`). At the end of a level it takes
the place of the date question and the install nudge. Its share is kind
`milestone` (`/s?k=milestone&m=<0 unit, 1 course, 2 streak, 3 passed>&n=<unit
number, levels or days>`), surface `proud_<moment>`, so `share_opened` and
`share_completed` by surface show which moments get sent.

### Monetisation and contact

| Event             | Fires when                                        |
| ----------------- | ------------------------------------------------- |
| `partner_clicked` | Outbound click to a credited source (name + url)  |
| `contact_clicked` | Footer phone/email tapped (`channel`, `location`) |

## Learner profile

The project runs `person_profiles: 'identified_only'` and there is no
`identify()` yet, so a profile is created by the first `setPersonProperties`
call — which `use-learner-analytics.ts` deliberately withholds until
`learner_stage` moves past `visitor`. Drive-by SEO traffic therefore stays
anonymous (materially cheaper per event, and the person list stays meaningful);
anyone who gets a sign into mastery gets a profile.

On mount, route change and tab focus, once past `visitor`, it writes:

`signs_mastered_pelican`, `signs_mastered_3d`, `board_levels_done`,
`board_levels_total`, `board_readiness` (0 to 100, the course page's figure),
`board_mock_best_clean`, `practice_streak_days`, `learner_stage`,
`test_date`, `test_days_left_bucket` (`none`, `past`, `0-7`, `8-30`, `31+`),
`test_per_day` (levels a day the plan asks for, 0 with none), `test_result`, and `first_seen_at` (set once). GA gets `test_booked` (`yes` or
`no`) as a user property.

`learner_stage` is also a **super property**, registered for _everyone_
including anonymous visitors (super properties don't create a profile), so any
trend or funnel can be broken down by it without a join:

`visitor` → `sampler` → `practising` → `committed`

Whichever half is further along sets it: any board level or mastered sign
makes a `sampler`, 5 of either `practising`, 26 levels or 40 signs `committed`.

The properties are read from the same localStorage the app already uses. If a
store's persisted shape changes, update the readers in that file.

## Dashboards, actions, cohorts and surveys

All in project 755646, all on production humans only (every insight sets
`filterTestAccounts`, which drops dev traffic, the internal cohort and bots).
Dashboard links: `https://us.posthog.com/project/755646/dashboard/<id>`.

**Actions**

| Action             | Id     | What                                                                                                                |
| ------------------ | ------ | ------------------------------------------------------------------------------------------------------------------- |
| Learned something  | 493634 | `board_level_completed`, `board_challenge_passed`, `pelican_completed`, `signs3d_completed`, `sign_check_completed` |
| Reached activation | 493635 | `board_level_completed` with `number >= 3`, or `pelican_completed` / `signs3d_completed`                            |
| Practised signs    | 493636 | `pelican_started`, `signs3d_started`, `sign_check_completed`                                                        |

"Learned something" is the active-learner definition: use it for weekly
active learners, retention and stickiness.

**Cohorts:** Activated (745931), Committed (745932), Test within 30 days
(745934, as of the learner's last visit), Arrived via share (745936), and the
built-in Internal / Test users (744655).

**Dashboards**

| Dashboard            | Id      | Answers                                                                                                                                                                             |
| -------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Weekly health        | 2391457 | Open first. Weekly active learners, activation rate by week, D1/D7/D30 retention, lifecycle, stickiness, levels per learner, mock clean tasks, NTSA results, pass rate by readiness |
| Growth and content   | 2391459 | Visitor to learner by landing page type, campaign source and referring site; sharing; shared link to learner; sign retention                                                        |
| Board on real phones | 2391460 | Board load time (median, p90, by device and tier), load failures, quality drops, activation by connection, page speed on the game                                                   |
| Board course         | 2391145 | First drive funnel, levels, abandons, mistakes, hints; level-by-level opened to finished, mock tests and new bests, settings changed                                                |
| Learners             | 2391147 | Stages, devices, retention on the board, sources, installs, sharing, bottom bar                                                                                                     |
| Road signs           | 2391150 | Sign trainer runs, chart vs 3D, most-missed signs                                                                                                                                   |
| Site health          | 2391155 | Errors, rage and dead clicks, web vitals                                                                                                                                            |
| Driving schools      | 2394142 | Learners who saw each school (also on Weekly health), tap-through rate, by day, drives in each school's car, site taps, where each school was seen and tapped                       |

**Surveys** (popover, any `driverush.ke` page, 30 days between surveys)

- `Board game: after a level` (01a1fc4f-87f7-0000-bcf5-17c6a81c649e): ease,
  test date, what would help. Fires on `board_level_completed`.
- `NPS: would you recommend DriveRush` (01a1fc77-9498-0000-5fad-face8edc6e9d):
  0 to 10 and a reason. Learners `practising` or `committed`, first seen 7+
  days ago.
- `What would you pay for` (01a1fc77-ca13-0000-21c6-7faec2b2a7c5): which paid
  extras and a monthly KES price. `committed` learners only.

**A survey shows only while its targeting flags are on.** Each survey has an
internal flag (`survey-targeting-…-custom`: not dismissed, not answered, no
survey in the last 30 days) and, if it has an audience, a second one
(`survey-targeting-…`). A survey created through the API or MCP gets those
flags switched off, and launching it (setting `start_date`) does not switch
them on. Nothing errors: the browser is sent the survey and no flag for it, so
it never shows. That is what happened to all three surveys from 21 to 24 Nov
2026 (no `survey shown` at all); the flags were switched on 24 Nov. After
creating a survey, check with `feature-flag-get-definition-by-key` that its
flags are `active`, and `feature-flag-enable` them if not. `surveys_opt_in`
on the project must be on too.

The weekly Discord summary (`scripts/weekly-summary.mjs`) reports active
learners, activation and NTSA passes alongside the older numbers, and each
school's learners reached and site taps.

**Annotations** (project-wide, on every chart): each release that moves the
numbers is marked at its commit time, from the NTSA card and board load events
(21 Nov 2026 05:12 UTC) through the schools changing with every task (23:09
UTC). Add one with `annotation-create` when a release changes how the board
plays, what it measures or which events fire.

**Errors:** a page move that ends on "No route matches" for a real page now
reloads the page instead of showing Road closed (`shouldLoadWhole` in
`app/lib/fresh-build.ts`), so those are no longer reported.

## Bot filtering

Bots are kept out of both tools, in layers:

| Layer                                              | Where                                                                                                | PostHog                    | GA                          |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------- | --------------------------- |
| Known bot user agents and `navigator.webdriver`    | posthog-js itself; `gaHeadScript` in `ga.ts` (also HeadlessChrome in `userAgentData`)                | dropped before sending     | not measured                |
| Bot user agents and data-centre IPs, on the server | `bot-traffic.ts`, through the root `loader` in `root.tsx`                                            | still captured             | the GA script is never sent |
| Custom bot rules (data-centre CIDR ranges)         | PostHog: Settings, Environment, Custom bots                                                          | labelled `$virt_is_bot`    | n/a                         |
| Test-account filter                                | PostHog project settings: `$virt_is_bot = false` with `app_env = production` and the internal cohort | dropped from every insight | n/a                         |
| Google's known-bot list                            | GA4, always on                                                                                       | n/a                        | dropped                     |

PostHog keeps capturing bots on purpose: they stay measurable
(`$virt_traffic_type`, `$virt_bot_name`), and the default filter leaves them
out of the numbers.

**The IP ranges live in two places**: PostHog's custom bot rules and
`DATACENTER_RANGES` in `bot-traffic.ts`. To add a range, add it to both
(`npx posthog-cli api call web-analytics-bot-rules-list '{}'` shows the
PostHog list) and add a test address to `bot-traffic.test.ts`. A data-centre
browser that slips through shows in PostHog as a burst of one-event "people"
from one network; `$virt_bot_name` empty and `$ip` in a hosting range.

GA's filtering only applies going forward: hits that already reached GA keep
the bots that got in before 2026-11-21.

## Adding an event

1. Add a method to `analytics` in `app/lib/analytics.ts` with a typed argument
   object and snake_case event/property names.
2. Call it from the component or store where the action completes.
3. Prefer semantics autocapture can't infer (correctness, progress, state).
   Don't hand-instrument ordinary link/button clicks — autocapture has them.
4. Document it in the table above.

## Local development

Dev builds capture too, with `debug: true` — every event is logged as
`[analytics] <name>` and `[PostHog.js] send "<name>"` in the console. They land
in the same project tagged `app_env: development`; filter them out in PostHog
(or exclude localhost under project settings → "Filter out internal and test
users") when reading production numbers.

## Known gaps

- **No server-side SDK.** There are no auth endpoints, API routes, actions, or
  webhooks — server work is read-only page data, so `posthog-node` would only
  duplicate the client's pageviews. Add it (and `tracing_headers`) the day a
  real server mutation ships.
- **No `identify()`.** Nothing identifies a learner yet. When accounts land,
  call `identify()` at login/signup; the anonymous history links automatically.
- **Proxy is Vercel-only.** The `/ingest` rewrites live in `vercel.json`. If
  the site ever moves to the Docker image, add the same proxy there.
- **Bundle cost.** PostHog is ~76 kB gzipped in its own chunk, loaded eagerly so
  the first paint is measured.
- **Feature flags / experiments** are available through the provider
  (`useFeatureFlagEnabled`) but nothing uses them yet.
- **Replay volume is a project setting.** The client records every session;
  cap the cost with a sampling rate / minimum duration in PostHog project
  settings rather than in code, so it can be tuned without a deploy. Replay
  and heatmaps must also be switched on there before data appears.

## Google Analytics 4

No library: the gtag snippet is ours, in `app/lib/ga.ts`.

### Two properties, picked by environment

Both live in the GA account **driverush** (417049674).

| Property          | Property ID | Measurement ID | Gets                                   |
| ----------------- | ----------- | -------------- | -------------------------------------- |
| `driverush.ke`    | 565305500   | `G-JH6E8C5H1J` | Production only: the real numbers      |
| `DriveRush (dev)` | 565373649   | `G-6D0HL2RW9R` | Localhost, Vercel previews, dev builds |

The code reads `VITE_PUBLIC_GA_MEASUREMENT_ID` at build time. Unset or empty,
GA does not load at all.

```
.env (local)                VITE_PUBLIC_GA_MEASUREMENT_ID=G-6D0HL2RW9R
Vercel: Production          VITE_PUBLIC_GA_MEASUREMENT_ID=G-JH6E8C5H1J
Vercel: Preview, Development VITE_PUBLIC_GA_MEASUREMENT_ID=G-6D0HL2RW9R
```

Outside a production build every hit is sent in debug mode, so local work
shows up in the dev property's **DebugView** straight away. Only the
production property has the custom definitions and filters below; the dev
one is for checking that events fire.

### How a visit is measured

| Piece             | File                                         | Notes                                                                                                                                       |
| ----------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Head script       | `app/lib/ga.ts` (`gaHeadScript`), `root.tsx` | Runs before React. Decides whether to measure, sets consent, configures the stream, sends the **landing page view** itself.                 |
| In-app page views | `app/lib/analytics.ts` (`usePageviews`)      | One `page_view` per new path, in a layout effect so it goes out before the new page's own events. A query change alone is not a page.       |
| Page labels       | `app/lib/page-meta.ts`                       | `content_group` and `page_template` from the route id. A test fails if a page route has no label.                                           |
| Events            | `app/lib/analytics.ts` (`emit`)              | Same taxonomy as PostHog, mapped to GA4 names where one exists (below). Every event carries the page's `content_group` and `page_template`. |
| User properties   | `use-learner-analytics.ts`, head script      | `learner_stage`, `board_levels_bucket`, `display_mode`.                                                                                     |

**Never measured:** `/tools/*`, a browser driven by a script
(`navigator.webdriver`, which covers the promo video recorder), a headless or
bot user agent, or a request from a data-centre range. See
[Bot filtering](#bot-filtering).

**Consent:** no banner. Consent Mode v2 defaults: `analytics_storage`
granted; `ad_storage`, `ad_user_data`, `ad_personalization` denied. Google
signals and ad personalisation off. There are no ads.

**URLs are cleaned** before they reach GA (`cleanPath`): only `utm_*`,
`gclid`, `level`, `task`, `learn` and `k` survive. `ttclid`, `fbclid`,
`igshid` and share payloads are dropped, so pages don't fragment in reports.
GA still reads the campaign from the landing URL, so attribution is
unaffected.

### Switches

- `?ga_debug=1` puts a production tab in debug mode, for **DebugView** (Admin →
  DebugView). `?ga_debug=0` stops it. The Developer traffic filter keeps
  these hits out of production reports.
- `?internal=1` marks this device as ours: every hit carries
  `traffic_type=internal`, which the Internal traffic data filter removes.
  Open `https://driverush.ke/?internal=1` once on each of your own phones and
  laptops. `?internal=0` clears it.

### Content groups

`Home`, `Board game`, `Board levels`, `Board guide`, `Sign trainer`,
`Sign class`, `Sign page`, `Signs hub`, `NTSA test`, `Guide`, `Blog`,
`Share landing`, `Info`, `Not found`. `page_template` is the route pattern for
dynamic pages (`/road-signs/:slug`, `/blogs/:slug`) and the path otherwise.
A 404 also sends `page_not_found` with `missing_path`: that is the broken inbound
links report.

### Event names in GA

| PostHog event                                            | GA4 event       | GA parameters                                              |
| -------------------------------------------------------- | --------------- | ---------------------------------------------------------- |
| `board_level_started`                                    | `level_start`   | `level_name`, `level_number`, `level_kind`, `unit`         |
| `board_level_completed`                                  | `level_end`     | the same, plus `success: true`                             |
| `board_challenge_passed`                                 | `post_score`    | `score`, `level_name` (the task id), `stars`, `seconds`, … |
| `share_completed`                                        | `share`         | `method` (channel), `content_type` (kind)                  |
| `contact_clicked`                                        | `generate_lead` | `method` (channel), `location`                             |
| `sign_graded`, `board_faulted`, `sign_challenge_started` | not sent        | too many to be useful in GA; PostHog has them              |
| everything else                                          | same name       | same parameters                                            |

GA4 limits are applied in `sanitizeGaParams`: names up to 40 characters,
25 parameters, text up to 100 characters.

### Property settings (production property)

These live in GA, not in code. Applied 2026-11-21 unless marked.

1. **Enhanced measurement** (Data streams → DriveRush website): page changes
   based on browser history events **off**, or every in-app page view counts
   twice (the app sends its own). Page loads, scrolls, outbound clicks, file
   downloads **on**. Site search, form interactions, video engagement
   **off**. Same on the dev stream.
2. **Google signals:** off.
3. **Data retention:** event and user data **14 months**.
4. **Custom definitions.** Event-scoped dimensions: `page_template`,
   `level_name`, `level_kind`, `unit`, `scope`, `category`, `challenge_id`,
   `rule`, `phase`, `channel`, `kind`, `surface`, `outcome`, `platform`,
   `tab`, `from`, `method`, `content_type`, `location`, `missing_path`,
   `lesson_id`, `sign_id`, `partner_name`. Event-scoped metrics:
   `level_number`, `score`, `stars`, `seconds`. User-scoped: `learner_stage`,
   `board_levels_bucket`, `display_mode`. (`content_group` is built in.) A new
   parameter is invisible in reports until it is registered here.
   Added 2026-11-21 for the NTSA test and board loading: dimensions Test
   result (`result`), Load failure reason (`reason`), Test booked
   (`booked`), and user-scoped Learner has a test date (`test_booked`);
   metrics Days until test (`days_until`), Days after test
   (`days_after_test`), Levels done at test (`levels_done`), Board readiness
   at test (`readiness`), Mock best clean at test (`mock_best_clean`).
5. **Key events: not done yet.** GA only lets an event be starred once it has
   arrived. After the first production traffic, star `level_end`,
   `sign_check_completed`, `app_installed`, `share`, `generate_lead` and
   `test_result_reported` under Admin → Events. Still pending on 2026-11-21:
   the events list was empty.
6. **Data filters:** Internal Traffic (`traffic_type = internal`) and
   Developer traffic, both **Active**. Neither is set on the dev property:
   all of its hits are debug hits.
7. **Search Console: not linked.** The Google account that owns the GA
   property has no verified Search Console property, so there is nothing to
   link yet. Verify `driverush.ke` in Search Console (a domain property, by
   DNS), then link it under Admin → Product links → Search Console links.
