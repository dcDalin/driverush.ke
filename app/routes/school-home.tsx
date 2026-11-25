/**
 * `/school`: where a driving school's owner and admins start. One school
 * goes straight to its dashboard; several (an admin can work for more than
 * one) are listed.
 */
import { data, Link, redirect } from "react-router";

import { SiteNav } from "~/components/brand/site-nav";
import { NeedsSignIn, NothingHere } from "~/components/school/signed-out";
import { Badge } from "~/components/ui/badge";
import { Card } from "~/components/ui/card";
import { listMySchools } from "~/database/schools/queries";
import { getRequestClient } from "~/lib/auth/require.server";

import type { Route } from "./+types/school-home";

export function meta() {
  return [
    { title: "Your driving school | DriveRush" },
    { name: "robots", content: "noindex" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase, headers, caller } = await getRequestClient(request);
  if (!caller.signedIn)
    return data({ signedIn: false as const, schools: [] }, { headers });
  const schools = await listMySchools(supabase, caller.userId);
  if (schools.length === 1 && schools[0])
    throw redirect(`/school/${schools[0].id}`, { headers });
  return data({ signedIn: true as const, schools }, { headers });
}

export default function SchoolHome({ loaderData }: Route.ComponentProps) {
  return (
    <>
      <SiteNav />
      <main className="mx-auto min-h-screen w-full max-w-5xl px-5 pb-24 text-ink sm:px-9">
        {!loaderData.signedIn ? (
          <NeedsSignIn
            title="Your driving school"
            body="Sign in with the email your school added you with to see your students and their progress."
          />
        ) : loaderData.schools.length === 0 ? (
          <NothingHere
            title="No school yet"
            body="This account is not an owner or admin of a driving school. Ask your school's owner to add your email."
          />
        ) : (
          <section className="flex flex-col gap-4 py-10">
            <h1 className="font-display text-[28px] font-bold tracking-tight">
              Your schools
            </h1>
            <ul className="flex flex-col gap-2">
              {loaderData.schools.map((school) => (
                <li key={school.id}>
                  <Card
                    asChild
                    className="flex-row items-center justify-between px-4 py-3 hover:bg-paper-2"
                  >
                    <Link to={`/school/${school.id}`}>
                      <span className="font-semibold">{school.name}</span>
                      <Badge
                        variant={school.role === "owner" ? "ink" : "outline"}
                      >
                        {school.role}
                      </Badge>
                    </Link>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}
