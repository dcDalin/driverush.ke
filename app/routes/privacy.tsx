/**
 * `/privacy`: what DriveRush stores and measures. Keep it in step with
 * `docs/analytics.md` and `app/lib/posthog.ts`.
 */
import { GuideLayout } from "~/components/brand/guide-layout";
import Body from "~/guides/privacy.mdx";
import { breadcrumbLd, graphLd, guideLd, pageMeta } from "~/lib/site";

import type { Route } from "./+types/privacy";

const PATH = "/privacy";
const CHECKED = "2026-11-24";
const TITLE = "Privacy: what DriveRush stores and measures";
const DESCRIPTION =
  "DriveRush has no accounts. What stays in your browser, what our analytics use, who else is involved, and how to ask us about your data.";

export function meta(_: Route.MetaArgs) {
  return [
    ...pageMeta({ title: TITLE, description: DESCRIPTION, path: PATH }),
    graphLd(
      breadcrumbLd([
        { name: "Home", url: "/" },
        { name: "Privacy", url: PATH },
      ]),
      guideLd({
        title: TITLE,
        description: DESCRIPTION,
        path: PATH,
        checked: CHECKED,
        published: "2026-11-05",
      }),
    ),
  ];
}

export default function Privacy() {
  return (
    <GuideLayout
      kicker="Privacy"
      title={
        <>
          Privacy. <em>In plain words.</em>
        </>
      }
      lede="No accounts. Here's what stays on your device and what we measure."
      checked={CHECKED}
      dateLabel="Updated"
    >
      <Body />
    </GuideLayout>
  );
}
