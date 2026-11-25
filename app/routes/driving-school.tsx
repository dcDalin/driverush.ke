/**
 * `/driving-schools-kenya/:slug`: one Kenyan driving school, for learners who
 * search it by name. Built from `lib/driving-school-pages.ts`, where every
 * fact carries the school's own source. The page states only what the school
 * publishes, says plainly when it publishes no prices, and never ranks.
 */
import { BoardStartCard } from "~/components/board/board-start-card";
import { GuideLayout } from "~/components/brand/guide-layout";
import { MDX } from "~/components/brand/mdx-components";
import { sponsorById } from "~/lib/board/sponsors";
import {
  DRIVING_SCHOOL_PAGES,
  DRIVING_SCHOOLS_PATH,
  drivingSchoolBySlug,
  type DrivingSchoolPage,
} from "~/lib/driving-school-pages";
import { breadcrumbLd, graphLd, guideLd, pageMeta } from "~/lib/site";

import type { Route } from "./+types/driving-school";

export function loader({ params }: Route.LoaderArgs) {
  const school = drivingSchoolBySlug(params.slug);
  if (!school) throw new Response("Not found", { status: 404 });
  return { slug: school.slug };
}

/** "KSh 24,900" → 24900, for the structured data; null when it isn't one plain amount. */
function amount(price: string): number | null {
  const match = /^KSh\s?([\d,]+)$/.exec(price.trim());
  return match ? Number(match[1]!.replace(/,/g, "")) : null;
}

function schoolLd(school: DrivingSchoolPage) {
  const offers = school.prices.flatMap((p) => {
    const value = amount(p.price);
    return value === null
      ? []
      : [
          {
            "@type": "Offer",
            name: p.course,
            price: value,
            priceCurrency: "KES",
            url: p.source.url,
          },
        ];
  });
  return {
    "@type": "DrivingSchool",
    name: school.name,
    ...(school.website ? { url: school.website } : {}),
    ...(school.social.length
      ? { sameAs: school.social.map((s) => s.url) }
      : {}),
    ...(school.phone ? { telephone: school.phone } : {}),
    areaServed: school.locations.map((place) => ({
      "@type": "Place",
      name: place,
    })),
    ...(offers.length ? { makesOffer: offers } : {}),
  };
}

export function meta({ data }: Route.MetaArgs) {
  const school = data && drivingSchoolBySlug(data.slug);
  if (!school) return [{ title: "Not found · DriveRush Kenya" }];
  const page = guideLd({
    title: school.title,
    description: school.description,
    path: school.path,
    published: school.published,
    checked: school.checked,
    type: "WebPage",
  });
  return [
    ...pageMeta({
      title: school.title,
      description: school.description,
      path: school.path,
    }),
    graphLd(
      breadcrumbLd([
        { name: "Home", url: "/" },
        { name: "Driving schools in Kenya", url: DRIVING_SCHOOLS_PATH },
        { name: school.name, url: school.path },
      ]),
      { ...page, about: schoolLd(school) },
    ),
  ];
}

function Source({ source }: { source: { label: string; url: string } }) {
  return (
    <MDX.a href={source.url} rel="noopener">
      {source.label}
    </MDX.a>
  );
}

function readableDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default function DrivingSchool({ loaderData }: Route.ComponentProps) {
  const school = drivingSchoolBySlug(loaderData.slug)!;
  const sponsor = school.sponsorId ? sponsorById(school.sponsorId) : null;
  const others = DRIVING_SCHOOL_PAGES.filter((s) => s.slug !== school.slug);
  const checked = readableDate(school.checked);
  const sources = [
    ...(school.website
      ? [{ label: `${school.name} website`, url: school.website }]
      : []),
    ...school.social,
    ...school.prices.map((p) => p.source),
    ...(school.courseLength ? [school.courseLength.source] : []),
    ...school.notes.map((n) => n.source),
  ].filter(
    (source, index, all) =>
      all.findIndex((other) => other.url === source.url) === index,
  );

  return (
    <GuideLayout
      kicker="Driving schools in Kenya"
      title={
        <>
          {school.name}. <em>Fees and contacts.</em>
        </>
      }
      lede={school.lede}
      checked={school.checked}
      lead={<BoardStartCard />}
    >
      {school.nameClash ? (
        <MDX.p>
          <strong>Check the town.</strong> {school.nameClash}
        </MDX.p>
      ) : null}

      <MDX.h2 id="fees">{school.name} fees</MDX.h2>
      {school.prices.length > 0 ? (
        <>
          <MDX.p>
            These are the prices {school.name} publishes itself. Prices change,
            so confirm the total with the school before you pay.
          </MDX.p>
          <MDX.table>
            <thead>
              <tr>
                <MDX.th>Course</MDX.th>
                <MDX.th>Published price</MDX.th>
                <MDX.th>Source</MDX.th>
              </tr>
            </thead>
            <tbody>
              {school.prices.map((p) => (
                <tr key={`${p.course}-${p.price}`}>
                  <MDX.td>{p.course}</MDX.td>
                  <MDX.td>
                    {p.price}
                    {p.note ? ` (${p.note})` : ""}
                  </MDX.td>
                  <MDX.td>
                    <Source source={p.source} />, {readableDate(p.asOf)}
                  </MDX.td>
                </tr>
              ))}
            </tbody>
          </MDX.table>
        </>
      ) : (
        <MDX.p>
          {school.name} doesn't publish its fees online that we could find
          (checked {checked}). Ask the school for the total in writing, and what
          it includes. We don't quote prices from other sites, because we can't
          check them.
        </MDX.p>
      )}
      <MDX.p>
        <strong>NTSA's fees are separate</strong> unless the school says its
        price includes them. For a first licence they come to KES 5,500, paid
        through eCitizen: see{" "}
        <MDX.a href="/ntsa-test">the NTSA test guide</MDX.a> for each one.
        Compare{" "}
        <MDX.a href={DRIVING_SCHOOLS_PATH}>
          what other driving schools in Kenya charge
        </MDX.a>
        .
      </MDX.p>

      <MDX.h2 id="where">Where to find {school.name}</MDX.h2>
      <MDX.ul>
        {school.locations.length > 0 ? (
          <li>
            <strong>Locations:</strong> {school.locations.join("; ")}.
          </li>
        ) : null}
        {school.website ? (
          <li>
            <strong>Website:</strong>{" "}
            <MDX.a href={school.website} rel="noopener">
              {school.website
                .replace(/^https?:\/\/(www\.)?/, "")
                .replace(/\/$/, "")}
            </MDX.a>
          </li>
        ) : null}
        {school.phone ? (
          <li>
            <strong>Phone:</strong> {school.phone}, as the school publishes it.
          </li>
        ) : null}
        {school.social.length > 0 ? (
          <li>
            <strong>Social pages:</strong>{" "}
            {school.social.map((s, i) => (
              <span key={s.url}>
                {i > 0 ? ", " : ""}
                <Source source={s} />
              </span>
            ))}
          </li>
        ) : null}
      </MDX.ul>

      {school.classes.length > 0 || school.courseLength ? (
        <>
          <MDX.h2 id="courses">Courses at {school.name}</MDX.h2>
          <MDX.ul>
            {school.classes.length > 0 ? (
              <li>
                <strong>Licence classes it lists:</strong>{" "}
                {school.classes.join(", ")}.
              </li>
            ) : null}
            {school.courseLength ? (
              <li>
                <strong>Course length:</strong> {school.courseLength.text} (
                <Source source={school.courseLength.source} />
                ).
              </li>
            ) : null}
          </MDX.ul>
        </>
      ) : null}

      {school.notes.length > 0 ? (
        <MDX.ul>
          {school.notes.map((note) => (
            <li key={note.text}>
              {note.text} (<Source source={note.source} />)
            </li>
          ))}
        </MDX.ul>
      ) : null}

      {sponsor ? (
        <>
          <MDX.h2 id="board">{school.name} on our Model Town Board</MDX.h2>
          <MDX.p>
            {school.name} sponsors our free{" "}
            <MDX.a href="/model-town-board">Model Town Board simulator</MDX.a>,
            and some of the learner cars wear its colours, copied from its own
            cars.{" "}
            <MDX.a href={`/model-town-board/play?school=${sponsor.id}`}>
              Drive the board in {school.name}'s car
            </MDX.a>
            . Sponsorship isn't a review or a ranking.
          </MDX.p>
        </>
      ) : null}

      <MDX.h2 id="before-you-pay">Before you pay any driving school</MDX.h2>
      <MDX.ol>
        <li>Ask to see the school's NTSA licence for that branch.</li>
        <li>Get the total in writing, and ask if NTSA's fees are in it.</li>
        <li>
          Ask how many lessons you get, and how many are behind the wheel.
        </li>
        <li>Ask which licence class the course is for, manual or automatic.</li>
        <li>Ask if you can practise on a Model Town Board before the test.</li>
      </MDX.ol>
      <MDX.p>
        Between lessons, practise the{" "}
        <MDX.a href="/model-town-board">Model Town Board</MDX.a> and the{" "}
        <MDX.a href="/road-signs">road signs</MDX.a>: both are on the NTSA test,
        and both are free here with no signup. We aren't a driving school, and
        NTSA requires every learner to enrol at a licensed one.
      </MDX.p>

      {others.length > 0 ? (
        <>
          <MDX.h2 id="other-schools">Other driving schools in Kenya</MDX.h2>
          <MDX.ul>
            {others.map((other) => (
              <li key={other.slug}>
                <MDX.a href={other.path}>{other.name}</MDX.a>
                {other.locations.length > 0 ? `, ${other.locations[0]}` : ""}
              </li>
            ))}
          </MDX.ul>
        </>
      ) : null}

      <MDX.h2 id="sources">Sources</MDX.h2>
      <MDX.ul>
        {sources.map((source) => (
          <li key={source.url}>
            <Source source={source} />, checked {checked}.
          </li>
        ))}
      </MDX.ul>
      <MDX.p>
        Run {school.name} and see something out of date? Send us your current
        price list and NTSA licence through the{" "}
        <MDX.a href="/about">contact details on our About page</MDX.a>.
      </MDX.p>
    </GuideLayout>
  );
}
