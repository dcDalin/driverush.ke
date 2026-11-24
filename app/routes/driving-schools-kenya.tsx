/**
 * `/driving-schools-kenya`: what driving schools charge and how to check one is licensed. Only lists a
 * school when its own published page confirms the price.
 */
import type { Route } from "./+types/driving-schools-kenya";

import Body from "~/guides/driving-schools.mdx";
import { DRIVING_SCHOOL_PAGES } from "~/lib/driving-school-pages";
import { absUrl, breadcrumbLd, graphLd, guideLd, pageMeta } from "~/lib/site";

import { GuideLayout } from "~/components/brand/guide-layout";
import { LearnerScene } from "~/components/brand/art/scenes";

const PATH = "/driving-schools-kenya";
const CHECKED = "2026-11-24";
const TITLE = "Driving schools in Kenya: fees and course length";
const DESCRIPTION =
  "Fees that Kenyan driving schools publish themselves, how long a course takes, how to check a school is NTSA licensed, and what to ask before you pay.";

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
