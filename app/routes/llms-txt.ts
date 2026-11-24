/**
 * `/llms.txt`: a short map of the site for AI assistants and answer engines,
 * in the format proposed at https://llmstxt.org (a Markdown file at the root).
 *
 * A resource route, like `sitemap-xml.ts`, built from the same data so it
 * never lists a page the sitemap leaves out (unconfirmed sign pages stay out).
 * Keep the facts here to what the pages themselves say: the same copy rules
 * apply (83 signs, free with no signup, NTSA's own fees, no ranking of schools).
 */
import { getAllPosts } from "~/lib/blog";
import {
  BOARD_GUIDES,
  BOARD_LEVELS_PATH,
  BOARD_PATH,
} from "~/lib/board-guides";
import { COURSE_LEVELS } from "~/lib/board/curriculum";
import { DRIVING_SCHOOL_PAGES } from "~/lib/driving-school-pages";
import {
  NTSA_QUESTIONS_DESCRIPTION,
  NTSA_QUESTIONS_PATH,
} from "~/lib/ntsa-questions-page";
import {
  isSignConfirmed,
  SIGN_PAGES,
  signHeading,
  signPagePath,
} from "~/lib/road-sign-pages";
import { SIGN_COUNT } from "~/lib/road-signs";
import { SIGN_CLASS_PAGES } from "~/lib/sign-class-pages";
import { absUrl } from "~/lib/site";

function link(path: string, title: string, note?: string): string {
  return `- [${title}](${absUrl(path)})${note ? `: ${note}` : ""}`;
}

export function buildLlmsTxt(): string {
  const levels = COURSE_LEVELS.length;
  const confirmedSigns = SIGN_PAGES.filter(isSignConfirmed);

  const lines = [
    "# DriveRush",
    "",
    `> DriveRush (driverush.ke) is a free learner-driver site for Kenya, with no signup. It has a 3D Model Town Board simulator with ${levels} levels, the ${SIGN_COUNT} Kenyan road signs on the Pelican chart and in 3D, and guides to the NTSA driving test, licence fees and driving schools in Kenya.`,
    "",
    "Key facts, as the linked pages state them:",
    "",
    "- NTSA requires every learner to enrol at a licensed driving school. DriveRush is practice alongside a school, not a replacement for one.",
    "- NTSA's own fees for a first licence come to KES 5,500: provisional licence KES 650, test booking KES 1,050, interim licence KES 750 and Smart DL KES 3,050 (read from NTSA's pages on 2026-11-05).",
    "- The Model Town Board rules taught here come from NTSA's learner handbook, Unit 3, and driving school tutorials. Each guide lists its sources and what a driving school must still confirm.",
    "- DriveRush does not rank driving schools. School prices are only shown when the school publishes them itself.",
    "",
    "## Model Town Board",
    "",
    link(
      BOARD_PATH,
      "Model Town Board simulator",
      `learn the board level by level in 3D, from the lanes to the roundabout and parking (${levels} levels)`,
    ),
    link(
      BOARD_LEVELS_PATH,
      "All Model Town Board levels",
      "every level, by unit",
    ),
    ...BOARD_GUIDES.map((guide) => link(guide.path, guide.title, guide.blurb)),
    "",
    "## NTSA driving test and licence",
    "",
    link(
      "/ntsa-test",
      "NTSA driving test guide",
      "the steps, NTSA's fees and what the test covers",
    ),
    link(
      NTSA_QUESTIONS_PATH,
      "NTSA driving test questions and answers",
      NTSA_QUESTIONS_DESCRIPTION,
    ),
    "",
    "## Driving schools in Kenya",
    "",
    link(
      "/driving-schools-kenya",
      "Driving schools in Kenya",
      "published fees, how to check a school is licensed and what to ask before you pay",
    ),
    ...DRIVING_SCHOOL_PAGES.map((school) =>
      link(school.path, school.title, school.description),
    ),
    "",
    "## Road signs",
    "",
    link(
      "/road-signs",
      "Kenyan road signs and their meanings",
      `all ${SIGN_COUNT} signs by class, with a free printable chart`,
    ),
    link(
      "/road-signs/pelican",
      "Pelican chart trainer",
      "learn the signs on the chart",
    ),
    link("/road-signs/3d", "3D signs trainer", "learn the signs as 3D models"),
    ...SIGN_CLASS_PAGES.map((p) => link(p.path, p.title, p.lede)),
    link(
      "/downloads/kenya-road-signs-chart.pdf",
      "Kenya road signs chart (PDF)",
      "printable",
    ),
    "",
    "## Articles",
    "",
    ...getAllPosts().map((post) =>
      link(`/blogs/${post.slug}`, post.title, post.description),
    ),
    "",
    "## Optional",
    "",
    ...confirmedSigns.map((sign) =>
      link(signPagePath(sign), `${signHeading(sign.name!)} (${sign.code})`),
    ),
    link("/about", "About DriveRush", "who makes it and how to reach us"),
    "",
  ];
  return lines.join("\n");
}

export function loader() {
  return new Response(buildLlmsTxt(), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
