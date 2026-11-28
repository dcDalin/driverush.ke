/**
 * `/driving-schools-kenya`: what driving schools charge and how to check one is licensed. Only lists a
 * school when its own published page confirms the price.
 */
import { LearnerScene } from "~/components/brand/art/scenes";
import { GuideLayout } from "~/components/brand/guide-layout";
import Body from "~/guides/driving-schools.mdx";
import { loadSchoolProfiles } from "~/lib/board/school-catalog.server";
import { DRIVING_SCHOOL_PAGES } from "~/lib/driving-school-pages";
import { PUBLIC_DATA_PAGE_CACHE } from "~/lib/http-cache";
import { absUrl, breadcrumbLd, graphLd, guideLd, pageMeta } from "~/lib/site";

import type { Route } from "./+types/driving-schools-kenya";

const PATH = "/driving-schools-kenya";
const CHECKED = "2026-11-24";
const TITLE = "Driving schools in Kenya: fees and course length";
const DESCRIPTION =
  "Fees that Kenyan driving schools publish themselves, how long a course takes, how to check a school is NTSA licensed, and what to ask before you pay.";

/** The schools on DriveRush: their logo and tagline for the list, by slug. */
/** Drawn from the schools' own data: the CDN keeps it five minutes. */
export function headers() {
  return { "Cache-Control": PUBLIC_DATA_PAGE_CACHE };
}

export async function loader() {
  const all = await loadSchoolProfiles();
  const profiles: Record<
    string,
    { logo: string | null; tagline: string | null }
  > = {};
  for (const page of DRIVING_SCHOOL_PAGES) {
    const own = page.schoolSlug ? all.get(page.schoolSlug) : undefined;
    if (own)
      profiles[own.slug] = {
        logo: own.logo?.src ?? null,
        tagline: own.tagline,
      };
  }
  return { profiles };
}

export function meta(_: Route.MetaArgs) {
  return [
    ...pageMeta({ title: TITLE, description: DESCRIPTION, path: PATH }),
    graphLd(
      breadcrumbLd([
        { name: "Home", url: "/" },
        { name: "Driving schools in Kenya", url: PATH },
      ]),
      guideLd({
        title: TITLE,
        description: DESCRIPTION,
        path: PATH,
        checked: CHECKED,
        published: "2026-11-05",
      }),
      {
        "@type": "ItemList",
        name: "Driving schools in Kenya with published prices",
        itemListElement: [
          ...DRIVING_SCHOOL_PAGES.map((school) => ({
            name: school.name,
            url: absUrl(school.path),
          })),
          {
            name: "The Kisumu National Polytechnic",
            url: "https://kisumupoly.ac.ke/wp-content/uploads/2025/07/Driving-TKNP-Brochure-Final.pdf",
          },
          {
            name: "Meru University of Science and Technology",
            url: "https://www.must.ac.ke/driving-school/",
          },
        ].map((school, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: school.name,
          url: school.url,
        })),
      },
    ),
  ];
}

export default function DrivingSchoolsKenya() {
  return (
    <GuideLayout
      art={<LearnerScene />}
      kicker="Guide · Driving schools"
      title={
        <>
          Driving schools in Kenya. <em>What to pay and check.</em>
        </>
      }
      lede="Published prices, how to check a school is licensed, and what to ask before you pay."
      checked={CHECKED}
    >
      <Body />
    </GuideLayout>
  );
}
