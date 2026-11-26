/**
 * The four demo schools, made the way they are for real and signed in as
 * the person who would do each step, so every function's own guard runs:
 * the fixture's su creates the school with an owner's email, the owner adds
 * branches and admins. An owner or admin who signs up after being added
 * takes up their invite on sign-up (private.match_pending_invites).
 */
import { DEMO_SCHOOLS, type SchoolSpec } from "../data/schools";
import { account, note } from "../ledger";
import { must, mustValue, serviceClient, signInAs } from "../local";

export type SeededSchool = {
  spec: SchoolSpec;
  id: string;
  branches: Map<string, string>;
  /** Who adds learners at each branch: its first signed-up admin, else the owner. */
  actorFor: Map<string, string>;
  /** The code its learners pay through (school_payment_settings). */
  passCode: string;
};

/** HELTZ-style codes: the slug in capitals, padded to the 3-letter minimum. */
export function passCodeFor(slug: string) {
  const code = slug.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return code.length >= 3 ? code.slice(0, 12) : `${code}DS`;
}

async function seedSchool(spec: SchoolSpec): Promise<SeededSchool> {
  const su = await signInAs("su@driverush.test");
  if (spec.owner.joins === "before")
    await account(spec.owner.email, spec.owner.name);
  const id = mustValue(
    `admin_create_school ${spec.slug}`,
    await su.rpc("admin_create_school", {
      p_name: spec.name,
      p_slug: spec.slug,
      p_owner_email: spec.owner.email,
    }),
  );
  if (spec.owner.joins === "after")
    await account(spec.owner.email, spec.owner.name);
  note({
    email: spec.owner.email,
    who: "school owner",
    where: spec.slug,
    state:
      spec.owner.joins === "after"
        ? "all branches (invite taken up on sign-up)"
        : "all branches",
  });

  const owner = await signInAs(spec.owner.email);
  const branches = new Map<string, string>();
  for (const branch of spec.branches) {
    const branchId = mustValue(
      `school_create_branch ${spec.slug}/${branch.name}`,
      await owner.rpc("school_create_branch", {
        p_school_id: id,
        p_name: branch.name,
        p_town: branch.town,
      }),
    );
    branches.set(branch.name, branchId);
  }

  const actorFor = new Map<string, string>();
  for (const admin of spec.admins) {
    if (admin.joins === "before") await account(admin.email, admin.name);
    const branchIds = admin.branches.map((name) => {
      const branchId = branches.get(name);
      if (!branchId) throw new Error(`${spec.slug} has no branch ${name}`);
      return branchId;
    });
    must(
      `school_add_admin ${admin.email}`,
      await owner.rpc("school_add_admin", {
        p_school_id: id,
        p_email: admin.email,
        p_branch_ids: branchIds,
      }),
    );
    if (admin.joins === "after") await account(admin.email, admin.name);
    if (admin.joins !== "never") {
      for (const name of admin.branches)
        if (!actorFor.has(name)) actorFor.set(name, admin.email);
    }
    note({
      email: admin.email,
      who: "branch admin",
      where: admin.branches.map((b) => `${spec.slug}/${b}`).join(", "),
      state:
        admin.joins === "never"
          ? "invited, no account"
          : admin.joins === "after"
            ? "invite taken up on sign-up"
            : "",
    });
  }
  for (const name of branches.keys())
    if (!actorFor.has(name)) actorFor.set(name, spec.owner.email);

  // Payments on, as staff do it after making the school's Paystack
  // subaccount (made-up codes: Paystack test mode needs real ones).
  const passCode = passCodeFor(spec.slug);
  must(
    `admin_set_school_payments ${spec.slug}`,
    await su.rpc("admin_set_school_payments", {
      p_school_id: id,
      p_code: passCode,
      p_subaccount_code: `ACCT_demo_${spec.slug}`,
      p_bank_label: "Demo Bank ••0000",
      p_account_name: spec.name,
      p_is_active: true,
    }),
  );

  return { spec, id, branches, actorFor, passCode };
}

export async function seedSchools() {
  const schools = new Map<string, SeededSchool>();
  for (const spec of DEMO_SCHOOLS)
    schools.set(spec.slug, await seedSchool(spec));
  await seedBankWaiting(schools);
  return schools;
}

/**
 * One school's owner has sent a new bank, waiting for DriveRush: the console
 * shows "1 bank waiting for a check" and the owner's dashboard says so. Its
 * old bank keeps being paid. Recorded the way the server records it (service
 * role, after its owner check; a made-up subaccount, Paystack is not called).
 */
async function seedBankWaiting(schools: Map<string, SeededSchool>) {
  const school = schools.get("petanns");
  if (!school) return;
  const { data: owner } = await serviceClient()
    .from("profiles")
    .select("id")
    .eq("email", school.spec.owner.email)
    .maybeSingle();
  if (!owner) return;
  must(
    "school_request_bank petanns",
    await serviceClient().rpc("school_request_bank", {
      p_school_id: school.id,
      p_actor: owner.id,
      p_subaccount_code: "ACCT_demo_petanns_new",
      p_bank_label: "KCB Bank ••5521",
      p_account_name: school.spec.name,
    }),
  );
  note({
    email: school.spec.owner.email,
    who: "school owner",
    where: "petanns",
    state: "sent a new bank (KCB ••5521): waiting for staff",
  });
}
