/**
 * The big schools (`data/big-schools.ts`), made the way they are for real:
 * staff create each with its owner's email, the owner adds its branches,
 * admins and students, signed in, so every function's guard runs. Students
 * with an account are with the school at once; the rest wait to join.
 *
 * Then a school DriveRush is setting up and has not handed over: staff add
 * its profile, branches and admins (owner, 2026-11-28: schools that are not
 * tech savvy are set up for them; never their students).
 */
import {
  BIG_SCHOOLS,
  type BigSchoolSpec,
  FIRST,
  LAST,
  SETUP_SCHOOL,
} from "../data/big-schools";
import { account, note } from "../ledger";
import { must, mustValue, signInAs } from "../local";

/** A fixed shuffle: the same names on every run. */
function person(i: number, salt: number) {
  const first = FIRST[(i * 7 + salt) % FIRST.length]!;
  const last = LAST[(i * 11 + salt * 3) % LAST.length]!;
  return { first, last, name: `${first} ${last}` };
}

/** Runs `work` over `items` a few at a time: fast, without flooding the stack. */
async function inBatches<T>(
  items: T[],
  size: number,
  work: (item: T, i: number) => Promise<unknown>,
) {
  for (let start = 0; start < items.length; start += size) {
    await Promise.all(
      items.slice(start, start + size).map((item, k) => work(item, start + k)),
    );
  }
}

async function seedBigSchool(spec: BigSchoolSpec, salt: number) {
  const su = await signInAs("su@driverush.test");
  await account(spec.owner.email, spec.owner.name);
  const id = mustValue(
    `admin_create_school ${spec.slug}`,
    await su.rpc("admin_create_school", {
      p_name: spec.name,
      p_slug: spec.slug,
      p_owner_email: spec.owner.email,
    }),
  );
  const owner = await signInAs(spec.owner.email);

  const branchIds: string[] = [];
  for (const branch of spec.branches) {
    branchIds.push(
      mustValue(
        `school_create_branch ${spec.slug}/${branch.name}`,
        await owner.rpc("school_create_branch", {
          p_school_id: id,
          p_name: branch.name,
          p_town: branch.town,
        }),
      ),
    );
  }

  // Admins: one to three branches each; the first few have signed up.
  const domain = spec.owner.email.split("@")[1]!;
  const admins = Array.from({ length: spec.admins.count }, (_, i) => ({
    ...person(i, salt),
    email: `admin${i + 1}@${domain}`,
    branches: Array.from(
      { length: 1 + (i % 3) },
      (_, k) => branchIds[(i + k * 5) % branchIds.length]!,
    ),
    signedUp: i < spec.admins.signedUp,
  }));
  await inBatches(admins, 6, async (admin) => {
    if (admin.signedUp) await account(admin.email, admin.name);
    must(
      `school_add_admin ${admin.email}`,
      await owner.rpc("school_add_admin", {
        p_school_id: id,
        p_email: admin.email,
        p_branch_ids: [...new Set(admin.branches)],
      }),
    );
  });

  // Students across the open branches: some with an account (with the
  // school now), the rest waiting to join.
  const total = spec.students.withAccount + spec.students.waiting;
  const students = Array.from({ length: total }, (_, i) => ({
    ...person(i, salt + 5),
    email: `learner${i + 1}@${domain.replace(/\.test$/, "")}-learners.test`,
    branch: branchIds[(i * 13) % branchIds.length]!,
    hasAccount: i < spec.students.withAccount,
  }));
  await inBatches(students, 10, async (s) => {
    if (s.hasAccount) await account(s.email, s.name);
    must(
      `school_add_student ${s.email}`,
      await owner.rpc("school_add_student", {
        p_branch_id: s.branch,
        p_email: s.email,
      }),
    );
  });

  note({
    email: spec.owner.email,
    who: "school owner (big school)",
    where: spec.slug,
    state: `${spec.branches.length} branches, ${spec.admins.count} admins, ${total} students`,
  });
  note({
    email: admins[0]!.email,
    who: "branch admin (big school)",
    where: spec.slug,
    state: `one of ${spec.admins.signedUp} with an account`,
  });
}

/** Staff set a school up for its owner: profile, branches, admins; no owner yet. */
async function seedSetupSchool() {
  const su = await signInAs("su@driverush.test");
  const id = mustValue(
    `admin_create_school ${SETUP_SCHOOL.slug}`,
    await su.rpc("admin_create_school", {
      p_name: SETUP_SCHOOL.name,
      p_slug: SETUP_SCHOOL.slug,
      p_owner_email: "",
    }),
  );
  must(
    `school_update_profile ${SETUP_SCHOOL.slug}`,
    await su.rpc("school_update_profile", {
      p_school_id: id,
      p_tagline: SETUP_SCHOOL.tagline,
      p_about: SETUP_SCHOOL.about,
      p_phone: "0711 222 333",
      p_whatsapp: "",
      p_email: "",
      p_website_url: "",
      p_socials: {},
      p_brand_paint: "",
      p_brand_ink: "",
    }),
  );
  const branchIds = new Map<string, string>();
  for (const branch of SETUP_SCHOOL.branches) {
    branchIds.set(
      branch.name,
      mustValue(
        `school_create_branch ${SETUP_SCHOOL.slug}/${branch.name}`,
        await su.rpc("school_create_branch", {
          p_school_id: id,
          p_name: branch.name,
          p_town: branch.town,
        }),
      ),
    );
  }
  for (const admin of SETUP_SCHOOL.admins) {
    must(
      `school_add_admin ${admin.email}`,
      await su.rpc("school_add_admin", {
        p_school_id: id,
        p_email: admin.email,
        p_branch_ids: admin.branches.map((b) => branchIds.get(b)!),
      }),
    );
  }
  note({
    email: "su@driverush.test",
    who: "DriveRush su",
    where: SETUP_SCHOOL.slug,
    state:
      "setting it up: profile, 2 branches, 2 admins invited; no owner, no logo",
  });
}

export async function seedBigSchools() {
  let salt = 0;
  for (const spec of BIG_SCHOOLS) await seedBigSchool(spec, salt++);
  await seedSetupSchool();
  return BIG_SCHOOLS.length + 1;
}
