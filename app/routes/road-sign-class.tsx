/**
 * `/road-signs/warning-signs`, `/mandatory-signs` and `/prohibitory-signs`: a
 * guide to one class of sign, then every sign in it. One file serves all three
 * routes (see `routes.ts`); the path picks the class. The text is MDX in
 * `app/guides/`, the list comes from the chart's data.
 */
import type * as React from "react";

import {
  LearnerScene,
  OpenRoadScene,
  RoadClosedScene,
} from "~/components/brand/art/scenes";
import { GuideLayout } from "~/components/brand/guide-layout";
import type { SignCategoryId } from "~/lib/image-focus";
import { mdxBodies } from "~/lib/mdx-bodies";
import { signClassPageByPath } from "~/lib/sign-class-pages";
import { breadcrumbLd, graphLd, guideLd, pageMeta } from "~/lib/site";

import type { Route } from "./+types/road-sign-class";

/** Each class's text, loaded on its own page only (`mdx-bodies.tsx`). */
const BODIES = mdxBodies({
  warning: () => import("~/guides/warning-signs.mdx"),
  mandatory: () => import("~/guides/mandatory-signs.mdx"),
  prohibitory: () => import("~/guides/prohibitory-signs.mdx"),
} satisfies Partial<Record<SignCategoryId, unknown>>);

const ART: Partial<Record<SignCategoryId, React.ReactNode>> = {
  warning: <OpenRoadScene />,
  mandatory: <LearnerScene />,
  prohibitory: <RoadClosedScene />,
};

export async function loader({ url }: Route.LoaderArgs) {
  const page = signClassPageByPath(url.pathname);
  if (!page) throw new Response("Not found", { status: 404 });
  await BODIES.load(page.category);
  return { path: page.path };
}

/** On a move from another page: the class's text arrives with its data. */
export async function clientLoader({
  url,
  serverLoader,
}: Route.ClientLoaderArgs) {
  const page = signClassPageByPath(url.pathname);
  const [data] = await Promise.all([
    serverLoader(),
    page ? BODIES.load(page.category) : undefined,
  ]);
  return data;
}

export function meta({ loaderData: data }: Route.MetaArgs) {
  const page = data && signClassPageByPath(data.path);
  if (!page) return [{ title: "Not found · DriveRush Kenya" }];
  return [
    ...pageMeta({
      title: page.title,
      description: page.description,
      path: page.path,
    }),
    graphLd(
      breadcrumbLd([
        { name: "Home", url: "/" },
        { name: "Road signs", url: "/road-signs" },
        { name: page.name, url: page.path },
      ]),
      guideLd({
        title: page.title,
        description: page.description,
        path: page.path,
        published: page.published,
        checked: page.checked,
      }),
    ),
  ];
}

export default function RoadSignClass({ loaderData }: Route.ComponentProps) {
  const page = signClassPageByPath(loaderData.path)!;
  return (
    <GuideLayout
      art={ART[page.category]}
      kicker={`Road signs · ${page.name}`}
      title={page.heading}
      lede={page.lede}
      checked={page.checked}
    >
      <BODIES.Body file={page.category} />
    </GuideLayout>
  );
}
