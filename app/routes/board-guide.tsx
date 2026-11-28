/**
 * The Model Town Board guides under `/model-town-board/`: the diagram, lane
 * options, questions and answers, the roundabout, the rules, and parking. One
 * file serves all their routes (see `routes.ts`); the path picks the guide. Their titles and
 * descriptions are in `lib/board-guides.ts` and their text is MDX in
 * `app/guides/`. Each one opens with a way into the trainer.
 */
import { Link } from "react-router";

import { BoardStartCard } from "~/components/board/board-start-card";
import { GuideLayout } from "~/components/brand/guide-layout";
import {
  BOARD_CHECKED,
  BOARD_PATH,
  boardGuideByPath,
  type BoardGuideId,
} from "~/lib/board-guides";
import { mdxBodies } from "~/lib/mdx-bodies";
import { ogCardAlt, ogCardPath } from "~/lib/og-cards";
import {
  BOARD_KEYWORDS,
  breadcrumbLd,
  graphLd,
  guideLd,
  pageMeta,
} from "~/lib/site";

import type { Route } from "./+types/board-guide";

/** Each guide's text, loaded on its own page only (`mdx-bodies.tsx`). */
const BODIES = mdxBodies({
  diagram: () => import("~/guides/board-diagram.mdx"),
  "lane-options": () => import("~/guides/board-lane-options.mdx"),
  questions: () => import("~/guides/board-questions.mdx"),
  roundabout: () => import("~/guides/board-roundabout.mdx"),
  rules: () => import("~/guides/board-rules.mdx"),
  parking: () => import("~/guides/board-parking.mdx"),
} satisfies Record<BoardGuideId, unknown>);

export async function loader({ url }: Route.LoaderArgs) {
  const guide = boardGuideByPath(url.pathname);
  if (!guide) throw new Response("Not found", { status: 404 });
  await BODIES.load(guide.id);
  return { path: guide.path };
}

/** On a move from another page: the guide's text arrives with its data. */
export async function clientLoader({
  url,
  serverLoader,
}: Route.ClientLoaderArgs) {
  const guide = boardGuideByPath(url.pathname);
  const [data] = await Promise.all([
    serverLoader(),
    guide ? BODIES.load(guide.id) : undefined,
  ]);
  return data;
}

export function meta({ loaderData: data }: Route.MetaArgs) {
  const guide = data && boardGuideByPath(data.path);
  if (!guide) return [{ title: "Not found · DriveRush Kenya" }];
  return [
    ...pageMeta({
      title: guide.title,
      description: guide.description,
      path: guide.path,
      extraKeywords: BOARD_KEYWORDS,
      ogImage: ogCardPath("board"),
      ogImageAlt: ogCardAlt("board"),
    }),
    graphLd(
      breadcrumbLd([
        { name: "Home", url: "/" },
        { name: "Model Town Board", url: BOARD_PATH },
        { name: guide.name, url: guide.path },
      ]),
      guideLd({
        title: guide.title,
        description: guide.description,
        path: guide.path,
        published: guide.published,
        checked: BOARD_CHECKED,
        image: ogCardPath("board"),
      }),
    ),
  ];
}

export default function BoardGuide({ loaderData }: Route.ComponentProps) {
  const guide = boardGuideByPath(loaderData.path)!;
  return (
    <GuideLayout
      kicker={`Model Town Board · ${guide.name}`}
      title={guide.title}
      lede={guide.lede}
      checked={BOARD_CHECKED}
      lead={
        <>
          <nav
            aria-label="Breadcrumb"
            className="mb-4 flex flex-wrap items-center gap-2 font-mono text-[10.5px] tracking-widest text-ink-3 uppercase"
          >
            <Link to={BOARD_PATH} className="hover:text-ink hover:underline">
              Model Town Board
            </Link>
            <span aria-hidden>/</span>
            <span aria-current="page">{guide.name}</span>
          </nav>
          <BoardStartCard />
        </>
      }
    >
      <BODIES.Body file={guide.id} />
    </GuideLayout>
  );
}
