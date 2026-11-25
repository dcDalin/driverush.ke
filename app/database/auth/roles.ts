/** Pure checks on a platform role (the token's `user_role` claim). */
import type { AppRole } from "../types";

export const APP_ROLES: readonly AppRole[] = [
  "driverush_su",
  "driverush_admin",
  "user",
];

/** A known role, or `user` for anything missing or unknown. */
export function parseRole(value: unknown): AppRole {
  return APP_ROLES.includes(value as AppRole) ? (value as AppRole) : "user";
}

export function isStaffRole(role: AppRole | null): boolean {
  return role === "driverush_su" || role === "driverush_admin";
}

export function isSuRole(role: AppRole | null): boolean {
  return role === "driverush_su";
}
