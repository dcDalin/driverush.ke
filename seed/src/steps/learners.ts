/**
 * The demo learners, each taken to their story's state through the RPCs the
 * dashboard and the learner's account menu call, signed in as the branch's
 * admin (or the owner) and as the learner. Only the passing of time is done
 * in SQL: a month that ran out is back-dated, since nothing else can make it.
 */
import { DEMO_LEARNERS, type LearnerSpec, type Place } from "../data/people";
import { account, note } from "../ledger";
import { must, mustValue, signInAs, sql } from "../local";
import type { SeededSchool } from "./schools";

type Schools = Map<string, SeededSchool>;

function resolve(schools: Schools, place: Place) {
  const [slug, branchName] = place.split("/") as [string, string];
  const school = schools.get(slug);
  const branchId = school?.branches.get(branchName);
  const actor = school?.actorFor.get(branchName);
  if (!school || !branchId || !actor) throw new Error(`Unknown place ${place}`);
  return { school, branchId, actor };
}

async function add(schools: Schools, place: Place, email: string) {
  const { branchId, actor } = resolve(schools, place);
  const client = await signInAs(actor);
  return mustValue(
    `school_add_student ${email} at ${place}`,
    await client.rpc("school_add_student", {
      p_branch_id: branchId,
      p_email: email,
    }),
  );
}

async function asActor(schools: Schools, place: Place) {
  return signInAs(resolve(schools, place).actor);
}

/** The month ran out: dates moved back 40 days, link closed as the app would. */
async function expire(linkId: string) {
  await sql`
    update public.school_student_links
       set starts_at = now() - interval '40 days',
           ends_at = now() - interval '10 days',
           ended_at = now() - interval '10 days',
           status = 'ended',
           end_reason = 'expired'
     where id = ${linkId} and status = 'active'`;
}

async function ownMonth(userId: string) {
  await sql`
    insert into public.learner_subscriptions (user_id, plan_id, starts_at, ends_at, source)
    select ${userId}, p.id, now() - interval '3 days', now() + interval '27 days', 'grant'
      from public.plans as p where p.code = 'learner_monthly'`;
}

async function seedLearner(schools: Schools, spec: LearnerSpec) {
  const { email, name, story } = spec;
  const join = () => account(email, name);

  switch (story.kind) {
    case "active": {
      if (story.joins === "before") await join();
      await add(schools, story.at, email);
      if (story.joins === "after") await join();
      return {
        where: story.at,
        state: `active (${story.joins === "after" ? "matched on sign-up" : "had an account"})`,
        joined: true,
      };
    }
    case "pending":
      await add(schools, story.at, email);
      return { where: story.at, state: "pending, no account", joined: false };
    case "cancelled": {
      const linkId = await add(schools, story.at, email);
      const client = await asActor(schools, story.at);
      must(
        "school_cancel_student_invite",
        await client.rpc("school_cancel_student_invite", { p_link_id: linkId }),
      );
      return {
        where: story.at,
        state: "invite cancelled, no account",
        joined: false,
      };
    }
    case "choosing":
      for (const place of story.at) await add(schools, place, email);
      await join();
      return {
        where: story.at.join(" + "),
        state: "choosing (two pending)",
        joined: true,
      };
    case "switched": {
      await add(schools, story.from, email);
      await join();
      const linkId = await add(schools, story.to, email);
      const me = await signInAs(email);
      must(
        "learner_accept_school_link",
        await me.rpc("learner_accept_school_link", { p_link_id: linkId }),
      );
      return {
        where: `${story.from} -> ${story.to}`,
        state: "switched school",
        joined: true,
      };
    }
    case "declined": {
      await add(schools, story.at, email);
      await join();
      const linkId = await add(schools, story.declined, email);
      const me = await signInAs(email);
      must(
        "learner_decline_school_link",
        await me.rpc("learner_decline_school_link", { p_link_id: linkId }),
      );
      return {
        where: story.at,
        state: `active, declined ${story.declined}`,
        joined: true,
      };
    }
    case "released": {
      const linkId = await add(schools, story.at, email);
      await join();
      const client = await asActor(schools, story.at);
      must(
        "school_release_student",
        await client.rpc("school_release_student", { p_link_id: linkId }),
      );
      return { where: story.at, state: "released by the school", joined: true };
    }
    case "moved": {
      const linkId = await add(schools, story.at, email);
      await join();
      const slug = story.at.split("/")[0] ?? "";
      const { school, branchId } = resolve(schools, `${slug}/${story.to}`);
      // The new branch may be another admin's: the owner moves them.
      const client = await signInAs(school.spec.owner.email);
      must(
        "school_move_student_branch",
        await client.rpc("school_move_student_branch", {
          p_link_id: linkId,
          p_branch_id: branchId,
        }),
      );
      return {
        where: `${slug}/${story.to}`,
        state: `active, moved from ${story.at}`,
        joined: true,
      };
    }
    case "expired": {
      const linkId = await add(schools, story.at, email);
      await join();
      await expire(linkId);
      return {
        where: story.at,
        state: "month ran out 10 days ago",
        joined: true,
      };
    }
    case "renewed": {
      const linkId = await add(schools, story.at, email);
      await join();
      await expire(linkId);
      await add(schools, story.at, email);
      return {
        where: story.at,
        state: "active again after an expired month",
        joined: true,
      };
    }
    case "paused": {
      const userId = await join();
      await ownMonth(userId);
      await add(schools, story.at, email);
      return {
        where: story.at,
        state: "active, own paid month paused",
        joined: true,
      };
    }
    case "paid":
      await ownMonth(await join());
      return { where: "-", state: "paid, plain cars", joined: true };
    case "free":
      await join();
      return { where: "-", state: "free", joined: true };
  }
}

/** Seeds every learner; returns the ones with an account, with their ordinal. */
export async function seedLearners(schools: Schools) {
  const joined: { spec: LearnerSpec; ordinal: number }[] = [];
  for (const [ordinal, spec] of DEMO_LEARNERS.entries()) {
    const result = await seedLearner(schools, spec);
    note({
      email: spec.email,
      who: "learner",
      where: result.where,
      state: result.state,
    });
    if (result.joined) joined.push({ spec, ordinal });
  }
  return joined;
}
