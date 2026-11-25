/**
 * `/school`: where a driving school's owner and admins start. One school
 * goes straight to its dashboard; several (an admin can work for more than
 * one) are listed.
 */
import { data, Link, redirect } from "react-router";

import { SiteNav } from "~/components/brand/site-nav";
import { NeedsSignIn, NothingHere } from "~/components/school/signed-out";
import { Badge } from "~/components/ui/badge";
import { signedInRequest } from "~/lib/school/server";

import type { Route } from "./+types/school-home";

export function meta() {
  return [
    { title: "Your driving school | DriveRush" },
    { name: "robots", content: "noindex" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase, headers, caller } = await signedInRequest(request);
  if (!caller.signedIn)
    return data({ signedIn: false as const, schools: [] }, { headers });
  const { data: rows } = await supabase
    .from("school_members")
    .select("role, schools(id, name, status)")
    .eq("user_id", caller.userId);
  const schools = (rows ?? [])
    .filter((row) => row.schools)
    .map((row) => ({ role: row.role, ...row.schools! }))
    .sort((a, b) => a.name.localeCompare(b.name));
  if (schools.length === 1)
    throw redirect(`/school/${schools[0]!.id}`, { headers });
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
                  <Link
                    to={`/school/${school.id}`}
                    className="flex items-center justify-between rounded-lg border border-line bg-surface px-4 py-3 hover:bg-paper-2"
                  >
                    <span className="font-semibold">{school.name}</span>
                    <Badge
                      variant={school.role === "owner" ? "ink" : "outline"}
                    >
                      {school.role}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}
