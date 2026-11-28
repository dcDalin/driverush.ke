import {
  index,
  layout,
  prefix,
  route,
  type RouteConfig,
} from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("road-signs", "routes/road-signs.tsx"),
  route("road-signs/pelican", "routes/road-signs-pelican.tsx"),
  route("road-signs/3d", "routes/road-signs-3d.tsx"),
  // Class guides. One file, three routes: the path picks the class.
  route("road-signs/warning-signs", "routes/road-sign-class.tsx", {
    id: "sign-class-warning",
  }),
  route("road-signs/mandatory-signs", "routes/road-sign-class.tsx", {
    id: "sign-class-mandatory",
  }),
  route("road-signs/prohibitory-signs", "routes/road-sign-class.tsx", {
    id: "sign-class-prohibitory",
  }),
  // One page per sign. The trainers and class guides above take priority.
  route("road-signs/:slug", "routes/road-sign.tsx"),
  route("model-town-board", "routes/model-town-board.tsx"),
  // The game alone, with no page under it. Every way into driving links here.
  route("model-town-board/play", "routes/board-play.tsx"),
  // Every level as a card to pick from.
  route("model-town-board/levels", "routes/board-levels.tsx"),
  // The board's guides. One file, one route each: the path picks the guide.
  route("model-town-board/diagram", "routes/board-guide.tsx", {
    id: "board-guide-diagram",
  }),
  route("model-town-board/lane-options", "routes/board-guide.tsx", {
    id: "board-guide-lane-options",
  }),
  route("model-town-board/questions", "routes/board-guide.tsx", {
    id: "board-guide-questions",
  }),
  route("model-town-board/roundabout", "routes/board-guide.tsx", {
    id: "board-guide-roundabout",
  }),
  route("model-town-board/rules", "routes/board-guide.tsx", {
    id: "board-guide-rules",
  }),
  route("model-town-board/parking", "routes/board-guide.tsx", {
    id: "board-guide-parking",
  }),

  // Permanent guides. MDX bodies live in `app/guides/`.
  route("guides", "routes/guides.tsx"),
  route("ntsa-test", "routes/ntsa-test.tsx"),
  route("ntsa-test/questions", "routes/ntsa-questions.tsx"),
  route("driving-schools-kenya", "routes/driving-schools-kenya.tsx"),
  route("driving-schools-kenya/:slug", "routes/driving-school.tsx"),
  route("derevaprep-alternative", "routes/derevaprep-alternative.tsx"),
  route("about", "routes/about.tsx"),
  route("privacy", "routes/privacy.tsx"),

  // Blog: index + dynamic per-post route. MDX bodies live in `app/blogs/`.
  route("blogs", "routes/blogs.tsx"),
  route("blogs/:slug", "routes/blogs-post.tsx"),
  // Became permanent guides. These outrank the `:slug` route above.
  route("blogs/ntsa-test-prep-kenya", "routes/legacy-redirects.ts", {
    id: "legacy-blog-ntsa",
  }),
  route("blogs/driving-schools-in-kenya", "routes/legacy-redirects.ts", {
    id: "legacy-blog-schools",
  }),

  // Where Google sends a learner back after signing in.
  route("auth/callback", "routes/auth-callback.tsx"),

  // Buying the full course (Paystack), and where Paystack sends the learner
  // back. Signed in to pay; private like the dashboards.
  route("pass", "routes/pass.tsx"),
  route("pass/done", "routes/pass-done.tsx"),

  // A driving school's dashboard (owners and branch admins). Signed in only.
  route("school", "routes/school-home.tsx"),
  // A dashboard frame like the console's: one page per section, and the add
  // forms as modal routes over their lists.
  route(
    "school/:schoolId",
    "routes/layouts/school-layout.tsx",
    { id: "school-layout" },
    [
      index("routes/school/overview.tsx"),
      // Pages show and link; every change is a modal route over its page.
      route("students", "routes/school/students.tsx", [
        route("add", "routes/school/student-add.tsx"),
        route(":linkId/:verb", "routes/school/student-change.tsx"),
      ]),
      route("passes", "routes/school/passes.tsx", [
        route("price", "routes/school/pass-price.tsx"),
        route("bank", "routes/school/pass-bank.tsx"),
      ]),
      route("team", "routes/school/team.tsx", [
        route("add", "routes/school/admin-add.tsx"),
        route(
          "invites/:inviteId/withdraw",
          "routes/school/invite-withdraw.tsx",
        ),
        route(":memberId/:verb", "routes/school/admin-change.tsx"),
      ]),
      route("branches", "routes/school/branches.tsx", [
        route("add", "routes/school/branch-add.tsx"),
        route(":branchId/edit", "routes/school/branch-edit.tsx"),
      ]),
      route("profile", "routes/school/profile.tsx", [
        route("edit", "routes/school/profile-edit.tsx"),
        route("logo/:kind", "routes/school/profile-logo.tsx"),
        route("branches/:branchId", "routes/school/profile-branch.tsx"),
      ]),
    ],
  ),
  // Resource routes for fetchers (no page of their own).
  route("api/me/school-invites", "routes/api/me.school-invites.ts"),
  route("api/me/places", "routes/api/me.places.ts"),
  route("api/board-schools", "routes/api/board-schools.ts"),
  // Asked by the GA head script once a visit, and by the shell after a form:
  // the per-visitor answers the prerendered pages can't carry.
  route("api/visit", "routes/api/visit.ts"),
  route("api/flash", "routes/api/flash.ts"),
  route("api/webhooks/paystack", "routes/api/webhooks.paystack.ts"),
  // DriveRush staff: schools, owners and staff roles. Signed in only.
  // A dashboard frame (side menu, top bar) around one page per section;
  // "new" and "grant" are modal routes drawn over the list that owns them.
  // Static `new` wins over `:schoolId`.
  route(
    "console",
    "routes/layouts/console-layout.tsx",
    { id: "console-layout" },
    [
      index("routes/console/overview.tsx"),
      // The list, and "New school" as a modal route over it.
      route("schools", "routes/console/schools.tsx", [
        route("new", "routes/console/school-new.tsx"),
      ]),
      // One school: a layout route (header and tabs stay put) around a page
      // per tab, every change a modal route over its tab. Static `new` (under
      // the list) wins over `:schoolId`.
      route(
        "schools/:schoolId",
        "routes/console/school.tsx",
        { id: "console-school" },
        [
          layout("routes/console/school-setup.tsx", [
            index("routes/console/school-setup-index.tsx"),
            route("hand-over", "routes/console/school-hand-over.tsx"),
            route("status", "routes/console/school-status.tsx"),
          ]),
          route("livery", "routes/console/school-livery.tsx", [
            route("upload", "routes/console/school-livery-upload.tsx"),
            route(
              ":liveryId/:verb",
              "routes/console/school-livery-confirm.tsx",
            ),
          ]),
          route("payments", "routes/console/school-payments.tsx", [
            route("review/:decision", "routes/console/school-bank-review.tsx"),
            route("code", "routes/console/school-code.tsx"),
            route("bank", "routes/console/school-bank.tsx"),
          ]),
          route("sponsorship", "routes/console/school-sponsorship.tsx", [
            route("new", "routes/console/school-sponsorship-new.tsx"),
          ]),
          // Helping a school set up (owner, 2026-11-28): the owner's own pages
          // and modals, as staff, under the console. Students are read only.
          route("profile", "routes/console/school-profile.tsx", [
            route("edit", "routes/school/profile-edit.tsx", {
              id: "console-profile-edit",
            }),
            route("logo/:kind", "routes/school/profile-logo.tsx", {
              id: "console-profile-logo",
            }),
            route("branches/:branchId", "routes/school/profile-branch.tsx", {
              id: "console-profile-branch",
            }),
          ]),
          route("branches", "routes/console/school-branches.tsx", [
            route("add", "routes/school/branch-add.tsx", {
              id: "console-branch-add",
            }),
            route(":branchId/edit", "routes/school/branch-edit.tsx", {
              id: "console-branch-edit",
            }),
          ]),
          route("team", "routes/console/school-team.tsx", [
            route("add", "routes/school/admin-add.tsx", {
              id: "console-admin-add",
            }),
            route(
              "invites/:inviteId/withdraw",
              "routes/school/invite-withdraw.tsx",
              { id: "console-invite-withdraw" },
            ),
            route(":memberId/:verb", "routes/school/admin-change.tsx", {
              id: "console-admin-change",
            }),
          ]),
          route("students", "routes/console/school-students.tsx"),
        ],
      ),
      route("payments", "routes/console/payments.tsx"),
      route("staff", "routes/console/staff.tsx", [
        route("grant", "routes/console/staff-grant.tsx"),
      ]),
    ],
  ),

  // Where shared achievement links land (`/s?k=quiz&…`). Deliberately short:
  // the URL travels through WhatsApp forwards. Renders a useful page for any
  // payload, including one that's broken or missing, and never 404s.
  route("s", "routes/share-landing.tsx"),

  // Retired pages, permanently redirected. See the route file for the targets.
  route("courses/*", "routes/legacy-redirects.ts", { id: "legacy-courses" }),
  route("practice", "routes/legacy-redirects.ts", { id: "legacy-practice" }),
  route("ntsa", "routes/legacy-redirects.ts", { id: "legacy-ntsa" }),
  route("design", "routes/legacy-redirects.ts", { id: "legacy-design" }),

  // SEO resource route — XML sitemap at /sitemap.xml (referenced by robots.txt).
  route("sitemap.xml", "routes/sitemap-xml.ts"),
  // A Markdown map of the site for AI assistants (https://llmstxt.org).
  route("llms.txt", "routes/llms-txt.ts"),

  // Internal authoring tools — own dashboard layout (sidebar + mobile sheet).
  ...prefix("tools", [
    layout("routes/layouts/tools-layout.tsx", [
      index("routes/tools/index.tsx"),
      route("image-coords", "routes/tools/image-coords.tsx"),
      route("sign-3d", "routes/tools/sign-3d.tsx"),
      route("share", "routes/tools/share.tsx"),
      route("board-network", "routes/tools/board-network.tsx"),
      route("sponsor", "routes/tools/sponsor.tsx"),
    ]),
    // Outside the dashboard layout on purpose: `?card=<id>` must render the
    // card alone so a 1200×630 screenshot contains nothing else.
    route("og", "routes/tools/og.tsx"),
    // The same, for the small car pictures in the board's car menu.
    route("car-thumb", "routes/tools/car-thumb.tsx"),
  ]),
] satisfies RouteConfig;
