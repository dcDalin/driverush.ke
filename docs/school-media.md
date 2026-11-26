# School profiles, liveries and media

A driving school's look on DriveRush is data, not code. Its words and logos
are a **profile** its owner edits. Its look on the board is a **livery**
DriveRush makes and publishes. Every picture lives in Supabase Storage. A
new school, or a changed look, needs no commit and no deploy.

## Where things are

| What                                                              | Where                                                           | Who changes it                                         |
| ----------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------ |
| Tagline, about, contacts, socials, colours                        | `school_profiles`                                               | the owner (dashboard, Profile) or staff                |
| Colour logo, white logo                                           | `school_profiles.logo`, `logo_mono` and the school-media bucket | the owner uploads; the server resizes and stores       |
| Branch address, map pin, phone, hours                             | `school_branches`                                               | the owner (dashboard, Profile, Branch details)         |
| Car wraps, roof board, banner, posters, marks, thumbnails, stills | `school_liveries` and the school-media bucket                   | DriveRush: art pipeline, then `npm run livery:publish` |
| Which livery shows                                                | `school_liveries.status` (one `live` per school)                | staff (console: Preview, Publish, Retire)              |
| Whose cars take turns for everyone                                | `school_sponsorships` (Kenyan dates)                            | staff (console: Sponsorship)                           |

The profile and branches also show on the school's public page,
`/driving-schools-kenya/<slug>` (where a page's `schoolSlug` names it):
"From the school" (logo, tagline, about, call, WhatsApp, email, website,
socials) and its branches with address, map, phone and hours, in the
server-rendered page and its structured data (`app/lib/school/public-profile.ts`).
The guide's list marks those schools "On DriveRush" with their tagline. Both
read the same cached `board_schools()` manifest, so an owner's edit shows
within its 5 minutes.

A school's **own learners** see its live livery whether or not it sponsors.
**Guests and free learners** see the sponsoring schools take turns. **Paid
learners** see plain cars.

## The bucket

`school-media` is public, takes at most 5 MB a file, and accepts WebP, PNG
and JPEG only. SVG is refused because it can carry script.

- It is declared in `supabase/config.toml` for local stacks, and in
  `supabase/schemas/storage/school_media_bucket.sql` for every other
  database.
- **Reading:** anyone, by public URL; no read policy exists for clients,
  because a public one would let anyone list the bucket.
- **Writing:** DriveRush staff only, on a password session: list, upload,
  replace and delete (`storage.objects` policies in the same schema file).
  School owners, learners and guests are refused; owners' logos go through
  the server (service role, after its owner check). `livery:publish` signs
  in as staff and goes through these same rules.
- `school_liveries` follows the same rule: anyone reads a live livery of an
  active school; staff read everything and are the only ones who insert
  (always a draft), edit or delete (never the live one); going live is
  `admin_publish_livery`. `school_profiles` is public while the school is
  active; only `school_update_profile` (owner, staff) writes it.
- Proven twice: in SQL (`school_media.test.sql`) and through the real
  Storage and Data APIs (`test/db/school-media.test.ts`).

**Paths are content names:** `<school_id>/<logo|livery>/<sha256, 16 hex>.<ext>`.

- The same bytes always have the same path, and a path never changes
  meaning.
- So every file is uploaded with a one-year `cache-control`, and there is
  never a `?v=`.
- The CHECKs in `_private/media_checks.sql` keep every stored path inside
  its own school's folder.

## How it reaches phones (and stays cheap)

1. **One manifest.**
   - `board_schools()` returns every active school with a profile or a live
     livery: public fields and paths only, no drafts, nobody's ids. It is
     about 24 KB for five schools before compression.
   - The server keeps it for 5 minutes (`school-catalog.server.ts`) and puts
     it in the root loader, so server-rendered pages need no extra request.
   - `/api/board-schools` serves the same list with
     `s-maxage=300, stale-while-revalidate=86400` for Vercel's CDN. A page
     older than 10 minutes (the installed app) refreshes from it.
2. **Immutable files** from Supabase's CDN, cached for a year.
   - Publishing a new livery uploads only the files that changed; the others
     keep their paths.
   - Phones download only what is new.
3. **Sizes made before upload.** Hi and lo wraps and banners are made by the
   art pipeline; logos are made by sharp on the server.
   - Colour logos are 1024 px wide, white logos 2048 px, both WebP.
   - The board picks hi or lo by quality tier.
   - Supabase's image transformation is off: it is billed per request.
4. **Offline.** The service worker (`public/sw.js`, registered as
   `/sw.js?media=<supabase origin>`):
   - keeps school-media files cache-first;
   - keeps the manifest stale-while-revalidate.

   A phone keeps every school it has seen. Every loader asks with
   `crossOrigin = "anonymous"`: WebGL and the plate canvas need it, and the
   worker only keeps CORS answers.

## Setting up a new school

1. **Console > New school.** Give its name and short name. Leave the owner's
   email empty to set it up first: the school is created in **set-up**,
   hidden from learners, the board and the site, and takes no students.
2. **On the school's page** (`/console/schools/<id>`), the checklist shows
   what is missing:
   - profile and logo, and branches, through "Edit profile and branches"
     (the school's own dashboard, which staff can open);
   - the livery: upload its folder on the Livery tab (below), preview,
     publish;
   - sponsorship and payments on their tabs.
3. **Hand over.** Type the owner's email and "Hand over and go live". The
   email becomes the owner (added, or invited until they sign up with it)
   and the school goes live. Later, the same card changes the owner.

The console's list pages 20 schools at a time and searches name, short name
and owner's email; it filters by status, livery and sponsorship. All of it
lives in the address, so a filtered page can be shared.

## Making or changing a school's livery

1. **Make the art.** The design source is `scripts/sponsor-art/<slug>/`
   (`design.mjs`, traced marks, fonts).
   - `npm run build:sponsors <slug>` writes the wraps, roof board, banner,
     posters and marks to `seed/fixtures/liveries/<slug>/`.
   - `livery.json` beside them gives the body colour, the rail colours, the
     roof board's size and the brand colours.
2. **Publish locally and take the pictures.**
   - `npm run livery:publish <slug> -- --live` on the local stack.
   - With the dev server up, `npm run build:car-thumbs` (car menu pictures,
     into `<slug>/thumbs/`).
   - Then the stills: see the comments in `scripts/build-og-images.mjs`,
     into `<slug>/stills/`.
   - Publish again. Only the new pictures upload.
3. **Check it.** `/tools/sponsor?id=<slug>` shows every part; the board with
   `?sponsor=<slug>`.
4. **Upload it (hosted or local): the console.** On the school's page,
   Livery tab, choose the livery folder (or all its files). The browser:
   - checks it is a whole livery and reads `livery.json` into the form
     (name, colours, roof board), which staff can change;
   - names every file by its content and uploads only those the bucket lacks
     (a second upload of the same folder sends nothing), with the staff
     session;
   - saves a **draft**. Preview opens it on the board; **Publish** asks first,
     then makes it the school's livery (the old one is retired). Drafts and
     retired liveries can be deleted; their files stay.
5. **Or from a terminal.**
   - `npm run livery:publish <slug> -- --hosted` needs
     `LIVERY_SUPABASE_URL` and `LIVERY_SUPABASE_PUBLISHABLE_KEY` (both public)
     in `.env.local`. It signs you in as DriveRush staff: your email (or
     `LIVERY_STAFF_EMAIL`) and your password, typed and never stored. A
     non-staff account is refused. Then it asks you to type the slug.
   - No service role key: staff upload and add drafts under row level
     security, like the console, and the draft records who made it.
   - It writes a **draft**.
   - Preview it at `/model-town-board/play?livery=<id>`, signed in as staff
     with a password.
   - Then **Publish** in the console (Schools > Liveries). The board switches
     within the manifest's 5 minutes.
6. **Sponsorship.** On the school's page, Sponsorship tab, add a period
   (from, until). With no end it runs until ended.

## A school leaves

- Console: **End today** on its sponsorship. Its cars stop taking turns
  tomorrow (Kenyan date).
- Retire the livery to take its look off its own learners' boards too.
- The files stay until a later cleanup. Remove them through the Storage API,
  never by deleting `storage.objects` rows in SQL, which leaves the files
  behind.

## The hosted cutover (one time)

The board shows plain cars in production until these steps are done:

1. Create the hosted project.
2. Push the baseline.
3. Set the Vercel env: `SUPABASE_*`, `VITE_SUPABASE_*` and
   `SUPABASE_SERVICE_ROLE_KEY`. The logo upload needs the service role key.
4. Create the five schools in the console.
5. For each school, run `npm run livery:publish <slug> -- --hosted`, then
   **Publish**.
6. Add each school's sponsorship.
7. Check the board as a guest. The network panel should show school-media
   URLs answering `cache-control: max-age=31536000`.

## Locally

- `npm run db:seed` publishes all five schools from `seed/fixtures/liveries/`.
- It fills their profiles from what they say publicly (sites and socials
  from `app/lib/driving-school-pages.ts`, phones from their cars) and adds
  demo branch details.
- It starts their sponsorships.
- A reset gives schools new ids, so the seed removes the last run's folders
  first.
- `npm run db:reset` alone has no liveries: plain cars.
