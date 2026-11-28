/**
 * The owner's own DriveRush su. The repo is public, so the address is never
 * in it: it comes from SEED_SU_EMAIL (set in the gitignored .env.local). The
 * role is granted by the fixture's su through grant_platform_role, as the
 * console would. Staff roles count on a password or Google session, so the
 * account gets a password: SEED_SU_PASSWORD, or the demo password.
 */
import { account, note } from "../ledger";
import { DEMO_PASSWORD, must, signInAs } from "../local";

export async function seedOwnerSu(env: NodeJS.ProcessEnv = process.env) {
  const email = env.SEED_SU_EMAIL?.trim().toLowerCase();
  if (!email) return null;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error(`SEED_SU_EMAIL is not an email address: ${email}`);
  }
  const password = env.SEED_SU_PASSWORD || DEMO_PASSWORD;
  const userId = await account(email, "DriveRush Owner", password);
  const su = await signInAs("su@driverush.test");
  must(
    "grant_platform_role",
    await su.rpc("grant_platform_role", {
      p_user_id: userId,
      p_role: "driverush_su",
    }),
  );
  note({
    email,
    who: "DriveRush su (SEED_SU_EMAIL)",
    where: "/console",
    state: env.SEED_SU_PASSWORD
      ? "password from SEED_SU_PASSWORD"
      : "demo password",
  });
  return email;
}
