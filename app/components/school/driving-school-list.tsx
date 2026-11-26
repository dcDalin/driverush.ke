/**
 * The guide's list of driving schools with their own page. A school on
 * DriveRush shows its logo and its own tagline (from its profile, read by the
 * guide's loader); the others show their first location, as before.
 */
import { useRouteLoaderData } from "react-router";

import { MDX } from "~/components/brand/mdx-components";
import { Badge } from "~/components/ui/badge";
import { DRIVING_SCHOOL_PAGES } from "~/lib/driving-school-pages";
import type { loader } from "~/routes/driving-schools-kenya";

export function DrivingSchoolList() {
  const data = useRouteLoaderData<typeof loader>(
    "routes/driving-schools-kenya",
  );
  const profiles = data?.profiles ?? {};
  return (
    <ul className="not-prose my-5 flex list-none flex-col gap-2 p-0">
      {DRIVING_SCHOOL_PAGES.map((school) => {
        const own = school.schoolSlug ? profiles[school.schoolSlug] : undefined;
        return (
          <li
            key={school.slug}
            className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5"
          >
            {own?.logo ? (
              <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-white p-1.5 ring-1 ring-line">
                <img
                  src={own.logo}
                  alt=""
                  className="max-h-full max-w-full object-contain"
                  loading="lazy"
                  crossOrigin="anonymous"
                />
              </span>
            ) : null}
            <span className="flex min-w-0 flex-col">
              <span className="flex flex-wrap items-center gap-2">
                <MDX.a href={school.path}>{school.name} fees</MDX.a>
                {own ? <Badge variant="outline">On DriveRush</Badge> : null}
              </span>
              <span className="text-[14px] text-ink-3">
                {own?.tagline ?? school.locations[0]}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
