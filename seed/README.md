# seed

Demo data for the **local** Supabase stack. Built like thinkrush
`packages/db-seed`, with two tiers.

| Tier                   | Command                                     | What you get                                                                                                                                                           |
| ---------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SQL seed (fast)        | `npm run db:reset`                          | Migrations, the reference rows (plans) and `supabase/seeds/local_demo.sql`: the test personas (2 schools, 11 people)                                                   |
| Full demo (TypeScript) | `npm run db:seed` (or `npm run db:refresh`) | Everything above, plus your own su, 4 more schools, 32 more learners in every state with progress, and all 6 schools' profiles, liveries (in Storage) and sponsorships |

The tests use the test personas, and both tiers have them. The pgTAP, db,
route and e2e suites pass after either command.

Every demo account's password is `driverush-local-1`. The emails end in
`.test`: they never reach a real inbox, and code emails land in Mailpit
(http://127.0.0.1:54724).

## Commands

```bash
npm run db:start            # the local stack (ports 54720-54729)
npm run db:sync             # Snaplet reads the database's shape: first time, and after every schema change
npm run db:seed             # wipe and seed (asks first in a terminal)
npm run db:seed -- --yes    # no question
npm run db:refresh          # db:sync, then db:seed
npm run seed:typecheck      # this folder's own typecheck (needs db:sync first)
```

`db:seed` starts with Snaplet's `$resetDatabase`. It empties the app's tables
and auth users without re-running migrations, so it takes about 6 seconds,
not the 30 or more of `db:reset`.

## Your own su

The repo is public, so your address is never committed. Put it in
`.env.local` at the repo root (gitignored):

```bash
SEED_SU_EMAIL=<your email>
SEED_SU_PASSWORD=<a password, optional>
```

`db:seed` creates that account, confirmed, with a password. The fixture's su
(`su@driverush.test`) then grants it `driverush_su` through
`grant_platform_role`. Console roles count only on a password session, so
sign in with the password, not Google. Without `SEED_SU_PASSWORD`
the password is the demo one.

On a hosted project nobody is seeded. Grant the first su by hand (SQL editor:
insert into `public.user_roles`), with a password nobody else uses.

## Who is in it

The command ends by printing this table.

**Test fixture** (`local_demo.sql`, used by the tests; do not change it for
the demo):

| Email                        | Who                                                                |
| ---------------------------- | ------------------------------------------------------------------ |
| `su@driverush.test`          | DriveRush su                                                       |
| `admin@driverush.test`       | DriveRush admin                                                    |
| `owner@heltz.test`           | Heltz owner (Nairobi CBD, Westlands)                               |
| `cbd.admin@heltz.test`       | Heltz admin, Nairobi CBD                                           |
| `westlands.admin@heltz.test` | Heltz admin, Westlands                                             |
| `owner@topgear.test`         | Top Gear owner (Thika Road)                                        |
| `amina@learner.test`         | active at Heltz Nairobi CBD, paid KES 700 through Heltz (progress) |
| `brian@learner.test`         | active at Heltz Westlands (progress)                               |
| `chebet@learner.test`        | added by Heltz and Top Gear: chooses                               |
| `dan@learner.test`           | own pass, no school                                                |
| `esther@learner.test`        | free account                                                       |

**Demo schools** (`src/data/schools.ts`, made through the real RPCs):

| School                     | Owner                                     | Branches                          | Admins                                                                                                                                             |
| -------------------------- | ----------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Blixen Auto Driving School | `owner@blixen.test`                       | Nairobi West, Kitengela, Machakos | `west.admin@blixen.test` (Nairobi West); `south.admin@blixen.test` (Kitengela and Machakos)                                                        |
| AA Driving School          | `owner@aa.test` (invited, then signed up) | Hurlingham, Mombasa, Nakuru       | `mombasa.admin@aa.test`; `nakuru.admin@aa.test`; `wanjiru@schools.test` (Hurlingham, and Petanns Kisumu); `new.admin@aa.test` (invite, no account) |
| Petanns Driving School     | `owner@petanns.test`                      | Kisumu, Eldoret                   | `eldoret.admin@petanns.test`; `wanjiru@schools.test` (Kisumu)                                                                                      |
| Stega Driving School       | `owner@stega.test`                        | Nairobi CBD                       | none (the owner adds learners)                                                                                                                     |

Every school takes passes: the fixture's `HELTZ` (KES 700) and `TOPGEAR`
(KES 600), and the demo schools' `BLIXEN`, `AADS`, `PETANNS` and `STEGA` (KES 700),
each with a made-up Paystack subaccount code.

**Demo learners** (`src/data/people.ts`, `<first name>@learner.test`). Each
one shows a link state:

| State                                      | Learners                                            |
| ------------------------------------------ | --------------------------------------------------- |
| active, matched when they signed up        | cynthia, david, joy, lilian, samuel, victor, winnie |
| active, paid for a pass through the school | achieng (Blixen), moses (AA)                        |
| active, had an account first               | baraka, kevin, nafula, tabitha                      |
| pending, no account yet                    | faith (Blixen), ruth (AA)                           |
| invite cancelled by the school             | queen                                               |
| choosing between two schools               | zawadi (Blixen / AA), brenda (Petanns / AA)         |
| switched school (accepted the second)      | collins (AA Nakuru, then Petanns Eldoret)           |
| declined a second school                   | diana (stays at Blixen Machakos)                    |
| released by the school                     | omar                                                |
| moved to another branch                    | halima (Blixen Nairobi West, then Machakos)         |
| month ran out                              | george, yusuf                                       |
| month ran out, then added again            | purity                                              |
| own pass, then added by a school           | ian                                                 |
| own pass, no school (sponsor cars)         | edwin, grace                                        |
| free account (rotating sponsors)           | hassan, irene, kelvin, mercy                        |

Progress (`src/data/progress.ts`) is worked out from each learner's position
in the list. It covers board levels done (real levels from the course list),
streaks (some lapsed), the NTSA test card (booked, passed or failed) and
today's drive. David, Nafula, Brenda and Kelvin have none, so the dashboards
show empty rows too. Every run gives the same people and the same numbers.

## How it works

`seed.ts` runs these steps in order:

1. **Guard** (`src/guard.ts`). The addresses must be loopback, and
   `private.is_local_stack()` must be true (the CLI's default JWT secret).
   Otherwise nothing is written. The URLs are fixed in `seed.config.ts` and
   `src/local.ts`, so no environment variable can point the seed at a hosted
   project. The keys come from `supabase status`.
2. **Reset** (`src/steps/reset.ts`). Snaplet `$resetDatabase`, then the
   reference-rows migrations (`supabase/migrations/*_reference_*.sql`) run
   again. The migration stays the one source for the plans.
3. **Fixture** (`src/steps/fixture.ts`) re-runs `local_demo.sql`.
4. **Your su** (`src/steps/owner-su.ts`).
5. **Schools** (`src/steps/schools.ts`). The su creates each school, and the
   owner adds its branches and admins. Every call is signed in as that
   person, so the functions' own guards run.
6. **Learners** (`src/steps/learners.ts`). The branch admin (or the owner)
   adds each learner, then the learner signs up, accepts or declines.
   Accounts come from the auth admin API, so the sign-up trigger matches
   invites as it would for real. Only the passing of time is SQL: a month
   that ran out is back-dated.
7. **Progress** (`src/steps/progress.ts`) writes rows in the app's
   `{ json: ... }` shape.
8. **Profiles, liveries, sponsorships** (`src/steps/media.ts`).
   - First it removes the last run's folders from the `school-media` bucket:
     a reset gives every school a new id.
   - Then, for each of the six schools:
     - It uploads `fixtures/liveries/<slug>/` (`src/media.ts`: content-named
       paths, one-year cache, files already stored are skipped) as a draft
       livery, and the su publishes it.
     - The owner fills in the profile and branch details, and the logos go
       in through `school_set_logo`.
     - The su starts a sponsorship.
   - Profiles use only what the schools publish (`src/data/school-profiles.ts`).
     Branch addresses say "demo branch", and branch phones are made up.

Snaplet is used only for the reset. Nothing is generated at random, and
Copycat is not used.

## Adding to it

- **A person or school**: add an entry to `src/data/people.ts` or
  `src/data/schools.ts`. For a new link state, add a `Story` kind and its case
  in `src/steps/learners.ts`, reached through the RPC a person would use.
- **A new table**: run `npm run db:sync` after the migration. If the table
  holds reference rows every database needs, put them in a
  `*_reference_*.sql` migration (idempotent, `on conflict do nothing`); the
  reset step re-runs it. Demo rows go in a step here.
- **A test persona**: only in `supabase/seeds/local_demo.sql`, and only when a
  test needs it.
- **A school's look**: its art in `fixtures/liveries/<slug>/` (see
  `docs/school-media.md`). `npm run livery:publish <slug>` sends one school
  without reseeding.
- Every email ends in `.test`, and every URL is loopback.
  `test/seed/local-only.test.ts` fails otherwise.

## Production

Seeds never reach a hosted database. `supabase db push` runs no seeds, so
never pass `--include-seed`. `local_demo.sql` does nothing unless
`is_local_stack()` is true, and this folder only knows `127.0.0.1`.

## Troubleshooting

- **`The local Supabase stack is not running`**: run `npm run db:start`.
- **Snaplet complains that the client is out of date, or a column is
  unknown**: the schema changed, so run `npm run db:sync` (or
  `npm run db:refresh`).
- **`<rpc>: forbidden`**: a step called a function as someone who may not, for
  example an admin acting on another admin's branch. Act as the owner, as the
  move step does.
