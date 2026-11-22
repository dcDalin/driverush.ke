# Asset rights

Who made what DriveRush uses, and what we're allowed to do with it. Keep this up
to date when an asset or an agreement changes. No personal contact details here.

## Pelican Signs name and logo
- **Position:** Pelican Signs agreed to DriveRush using their name and logo. They get free promotion and we get a known brand. No money changes hands, so it is not a partnership and must not be described as one.
- **Used in:** the "Pelican chart" trainer name and URL, the credit line, and the logos on the chart and 3D sign posts.
- **Agreed on:** _to fill in: date_
- **Agreed by:** _to fill in: role at Pelican Signs_
- **In writing:** _to fill in: where the confirmation is kept_

## Chart and 3D models
- **Made by:** the DriveRush team, in-house. Files: `public/assets/road-signs/road-signs.v2.svg`, `public/assets/road-signs/models/`.
- **Contractors:** _to fill in: anyone paid to draw or model these, and where the assignment of rights is kept_
- Do not credit Pelican Signs as the author of this artwork.
- **Missing:** the 3D model for M.5 (Pass to the left). `M_5.glb` was an exact copy of the M.7 bicycle, so it was deleted and M.5 is out of the 3D trainer until it's re-exported. Add it back in `app/data/road-signs-3d.json` or `/tools/sign-3d`. The chart trainer still has M.5.

## Model Town Board
- **Made by:** the DriveRush team's own code, except the cars (below).
- **The board** (roads, markings, kerbs, the parking zone, the stopping box) is drawn by `app/lib/board/full-board.ts`. Its layout follows the boards Kenyan driving schools paint, and its proportions were measured off a reference drawing of one. No artwork was copied from either.
- **The cars** (since 2026-11-21) are free models from Sketchfab, downloaded with the owner's account: five cars on 2026-11-21, a van, a lorry and a minibus on 2026-11-22. Each one's licence was read on its page that day.
  - **Saloon:** "2014 Toyota Corolla E180 EU (with interior)" by Armored Wave, CC BY 4.0. https://sketchfab.com/3d-models/2014-toyota-corolla-e180-eu-with-interior-36f95efb0585464cae43a25a3b3392e8. The author says it is free to use in any project. In a comment, they ask users to remove Toyota's logos and lettering; the model's own pictures carry none, and anything modelled in its bodywork is covered by our paint.
  - **Hatchback:** "2016 Nissan Note" by snowcappedandescrash (also shown as franco/billowous), Sketchfab Free Standard. https://sketchfab.com/3d-models/2016-nissan-note-3929336debbf45a8a2e4096f1fdf5baa. The author says it was "modeled by me" in Blender and is free to use as long as nobody else takes credit. It carries a NoAI tag: not for AI training or datasets. Its materials suggest it was also used in a Roblox game. It has no wheels, so it wears the saloon's.
  - **Wagon:** "Toyota Probox" by tnikita (Ford mondeo; the file credits "mamont nikita"), CC BY 4.0. https://sketchfab.com/3d-models/toyota-probox-1b48dd220c69495e8f278376fb7a3add. It has no description. It is a SketchUp model built partly from 3D Warehouse parts, so the uploader may not be the original author of every part.
  - **Pickup:** "Toyota Hilux" by David_Holiday, CC BY 4.0. https://sketchfab.com/3d-models/toyota-hilux-417915f419f945c8a424b2a7943eb25a. Its original file is a SketchUp .kmz, which may come from 3D Warehouse.
  - **SUV:** "Urban '10 - Low poly model" by Daniel Zhabotinsky, CC BY 4.0. https://sketchfab.com/3d-models/urban-10-low-poly-model-2866efdfa943484391ef8313768e074d. A generic design by its author, who gives "unconditional permission" to use and change it.
  - **Van:** "Low Poly 2013 Toyota HiAce" by Alvin.Woodly, CC BY 4.0. https://sketchfab.com/3d-models/low-poly-2013-toyota-hiace-f83b4ed4d8534efb81def77b6c1b642d. The author describes it as their low poly HiAce, "scaled to somewhat realistic measurements"; its parts carry plain modelling names. True to size on the board.
  - **Lorry:** "Isuzu truck" by igbalabdrahmane, CC BY 4.0. https://sketchfab.com/3d-models/isuzu-truck-434367858e7240b2b93db7bedb431157. A light lorry with drop sides and a canvas cover. It has no description; its materials carry drawing-office (CAD) library names, so it is not a game model, but the uploader may not be its first author. True to size on the board.
  - **Minibus:** "Isuzu Elf truck XYZ" by ann_fenek, CC BY 4.0. https://sketchfab.com/3d-models/isuzu-elf-truck-xyz-ee9e569d3fea439cb41166d07aeb7cca. An Elf with a minibus body, downloaded on 2026-11-22. It has no description; its parts carry plain Maya modelling names (`polySurface`, `pCylinder`, `lambert`), as a hand-made model's do. True to size on the board.
  - **Turned down:** a "2007 Toyota Yaris Hatchback" and a "2017 Toyota RAV4" (both Free Standard). Their files carry game-mod and ripping-tool part names, so they are probably taken from games. Kept out of the repository and out of the app. On 2026-11-22, a "2013 Toyota Land Cruiser Prado" by Romanov_13 (CC BY): its parts carry Roblox export names. Also passed over that day without downloading: a "2006 Isuzu Elf" tagged with a racing game's name, a Prado that looked like a game export, and an Isuzu flatbed generated with an AI tool.
  - **What we changed** (`scripts/build-real-cars.mjs`): the cabin insides, engines and number plates removed; a dark block in the cabin; fewer triangles; smaller pictures; the bodywork made plain white for the board's paint and schools' wraps. Badges a model has are kept.
  - **Credit:** CC BY 4.0 asks for the author's name, a link to the model and the licence, and a note that it was changed. The board's settings sheet does this under "Your car" (`ModelCredit`), from the `model` entries in `app/lib/board/cars.ts`.
  - **Free Standard:** commercial use is allowed. The files must not be passed on on their own. Inside the app is fine.
  - **In the repository:** only the built models in `public/assets/board/cars/`. The downloads stay outside it, in `~/Downloads/board-cars/<car>/` on the owner's machine.
  - **Fallback:** if a model can't be fetched, the board draws the saloon modelled in our own code in `app/components/board/car-model.ts`.
- **Retired on 2026-11-21:** the "LowPoly_Cars_01" pack's saloon, SUV and pickup (added on 2026-11-11, `scripts/build-board-cars.mjs`). The owner states the pack is free for commercial use; where it came from was never recorded.
- The table, its wood and the floor are drawn in code in `app/components/board/board-table.tsx`.
- **Removed on 2026-11-11:** the cars and trees from Kenney's "Racing Pack" (CC0), used by the earlier 2D game. They are no longer in the repository.

## Driving schools' brands (Model Town Board sponsors)
- **What they are:** each school's name, logo and car paint, copied from the school's own car and logo so the board car is recognisably theirs. Drawn by `scripts/sponsor-art/<id>/design.mjs`, built by `npm run build:sponsors` into `public/assets/board/sponsors/<id>/`.
- **Heltz Driving Academy:** copied from the owner's photo of their car (`scripts/sponsor-art/heltz/reference.jpg`). Their real car has no roof board; the one on the board cars is our design in their look (owner, 2026-11-21).
  - **Agreement and artwork:** _to fill in: who at Heltz agreed, when, and where their artwork files are kept_
- **Top Gear Driving School** (added 2026-11-21): copied from three photos of their cars and their logo, supplied by the owner (`scripts/sponsor-art/topgear/reference-*.{png,jpg}`, `logo.jpg`). The TG mark is traced from their logo. Their door lettering has no free match, so its letters are drawn to the photo's shapes.
  - **Agreement and artwork:** _to fill in: who at Top Gear agreed, when, and where their artwork files are kept_
- **Blixen Auto Driving School (B.A.D.S)** (added 2026-11-22): copied from photos of their cars and their logo, supplied by the owner (`scripts/sponsor-art/blixen/reference-*.jpg`, `logo.jpg`). The photos were cropped to the cars and the roof board before they were added, so no person appears in them. Their steering-wheel logo and the big BADS are traced from their logo. Their phone number is on the paint as on their cars, and the board links to their site, bads.co.ke (owner, 2026-11-22).
  - **Agreement and artwork:** _to fill in: who at Blixen agreed, when, and where their artwork files are kept_
- **AA Driving School (AA Kenya)** (added 2026-11-22): copied from photos of their cars and their logo, supplied by the owner (`scripts/sponsor-art/aa/reference-*.jpg`, `logo.png`). The one photo with people in it was cropped to the roof board and the bonnet before it was added. Their logo, lion included, is traced from the one they publish. The board links to their site, aakenya.co.ke. AA Kenya is a large organisation with a well-known mark: have their agreement in writing before relying on this.
  - **Agreement and artwork:** _to fill in: who at AA Kenya agreed, when, and where their artwork files are kept_
- **Petanns Driving School** (Petanns Kenya, "Shule Ya Wakenya"; added 2026-11-22): copied from photos of their cars and their emblem, supplied by the owner (`scripts/sponsor-art/petanns/reference-*.jpg`, `logo.jpg`). Their emblem is shown as their own picture; it has a photograph of a car in it, whose own rights are theirs to answer for. Its outline is traced for one-colour places. Their phone number is on the paint as on their cars. Their real cars carry no roof board; the one on the board cars is our design in their look. No link: none of their material shows a site.
  - **Agreement and artwork:** _to fill in: who at Petanns agreed, when, and where their artwork files are kept_
- **Typefaces standing in for the schools' lettering** (all SIL Open Font License, files and licences in `scripts/sponsor-art/fonts/`): Rubik Mono One and Righteous (Heltz); Anton, Alfa Slab One and Arvo Bold (Top Gear); Poppins and Michroma (Blixen); Poppins (AA); Alfa Slab One, Kaushan Script and Poppins (Petanns). Only pictures made with them are shipped, never the font files.
- **If a school's sponsorship ends:** set `live: false` in `app/lib/board/sponsors.ts` (or remove its entry) and delete its folder in `public/assets/board/sponsors/`.

## Voice clips
- **Made with:** ElevenLabs, on a paid plan. The clips in `public/assets/road-signs/sounds/` carry ElevenLabs content tags.
- **Receipt:** _to fill in: where the proof of the paid plan is kept_
- **File names:** some clip names don't match their sign's code, because the chart's codes are one off from the source list. M.7 plays `M.6.mp3`, M.8 plays `M.7.mp3`, M.9 plays `M.8.mp3`, and P.16 and P.17 play each other's. `audioSrc` in the data files is the source of truth. `P.38.mp3` is unused.

## Promo video music
- **Made by:** the DriveRush team, in-house. The three music beds in `marketing/social/music/` are generated by `marketing/social/make-music.mjs` from code alone. No samples, loops or third-party recordings.
- The videos' other sounds are the app's own effects and voice clips (see Voice clips).
- **Mixkit (videos 18 to 20, added 2026-11-16):** music `mk-midnight-funk` ("Midnight Funk", Michael Ramir C., Mixkit #1147), `mk-sweet-september` ("Sweet September", Arulo, #282), `mk-complicated` ("Complicated", Arulo, #281), and the effects in `marketing/social/sfx/` (#1061 tick, #577 drum roll, #2903 whoosh impact, #1490 whoosh, #3005 pop, #2870 correct tone, #948 buzzer, #600 bell). Mixkit Stock Music Free License and Sound Effects Free License, read on mixkit.co/license on 2026-11-16: commercial use in social media video posts and online marketing ads allowed, no credit needed; not allowed: redistributing the files on their own, remixing the music into a music-only track, registering them with a rights management service. So the raw files are never passed on, and only the finished videos are posted. The whole `marketing/` folder is kept out of git (`.gitignore`). A claim on a post goes to team@mixkit.co.

## Sign notes
- **Source:** written in DriveRush's own words on 2026-11-04, from NTSA / Highway Code material. Same instructions, no new facts.
- **Stored in:** `app/data/road-signs-pelican.json` and `app/data/road-signs-3d.json`. Keep the two identical by sign code.

## If Pelican's permission ever ends
1. Remove `SignCredit` and the footer line that says the name and logo are used with permission.
2. Rename the trainer in the copy, and move `/road-signs/pelican` to a new URL with a 301.
3. Remove the logo from the 3D models: it's one material per model (`lambert8_Pelican_Logo*`), on 78 of 84 models, about 4% of the geometry.
4. Remove the Hi-Way Signs banner and Pelican logo from the chart: 31 elements around x 826-1077, y 463-673. No sign overlaps them.
5. Remove "Pelican" from the SEO keywords in `app/lib/site.ts`, the social cards and the blog posts, then regenerate the cards with `npm run build:og`.
