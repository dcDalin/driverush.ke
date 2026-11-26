/**
 * The school dashboard's student filters, kept apart from the panel so they
 * can be tested: the statuses offered and which students match.
 */
import type { StudentRow } from "~/database/schools/dashboard";

export const ALL = "all";

export const STUDENTS_PAGE_SIZE = 25;

export const STUDENT_STATUSES = [
  { value: ALL, label: "Everyone" },
  { value: "active", label: "With you this month" },
  { value: "paid", label: "Has a pass" },
  { value: "unpaid", label: "No pass yet" },
  { value: "pending", label: "Waiting to join" },
  { value: "expired", label: "Invite expired" },
] as const;

/** Most times an invite may be sent (the database holds the same limit). */
export const MAX_SENDS = 5;

/** Which students match the search and filters (pure, for tests). */
export function filterStudents(
  students: StudentRow[],
  { q, branch, status }: { q: string; branch: string; status: string },
) {
  const needle = q.trim().toLowerCase();
  return students.filter((s) => {
    if (branch !== ALL && s.branchId !== branch) return false;
    if (status === "active" && s.status !== "active") return false;
    if (status === "pending" && (s.status !== "pending" || s.inviteExpired))
      return false;
    if (status === "expired" && !s.inviteExpired) return false;
    if (status === "paid" && !s.passEndsAt) return false;
    if (status === "unpaid" && (s.passEndsAt || s.status !== "active"))
      return false;
    if (!needle) return true;
    return (
      s.email.toLowerCase().includes(needle) ||
      (s.name ?? "").toLowerCase().includes(needle)
    );
  });
}
