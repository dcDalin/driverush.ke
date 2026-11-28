/**
 * A school dashboard's map: the side menu's groups and pages for one school
 * and one person. A branch admin gets students and passes; the owner (and
 * DriveRush staff) also get the team, the branches and the profile.
 */
import {
  GridIcon,
  LearnerIcon,
  PeopleIcon,
  PinIcon,
  SchoolIcon,
  WalletIcon,
} from "~/components/brand/icons";
import type { DashGroup } from "~/components/console/shell";

export const schoolPath = (schoolId: string, page = "") =>
  `/school/${schoolId}${page ? `/${page}` : ""}`;

export function schoolNav(
  schoolId: string,
  {
    canManage,
    bankNeeded,
  }: {
    canManage: boolean;
    /** No bank yet: learners cannot pay. */ bankNeeded: boolean;
  },
): DashGroup[] {
  const groups: DashGroup[] = [
    {
      label: null,
      pages: [
        {
          id: "overview",
          label: "Overview",
          to: schoolPath(schoolId),
          icon: GridIcon,
          description: "What needs you, and how your school is doing.",
        },
      ],
    },
    {
      label: "Learners",
      pages: [
        {
          id: "students",
          label: "Students",
          to: schoolPath(schoolId, "students"),
          icon: LearnerIcon,
          description: "Everyone you have added, their progress and pass.",
        },
      ],
    },
    {
      label: "Money",
      pages: [
        {
          id: "passes",
          label: "Passes",
          to: schoolPath(schoolId, "passes"),
          icon: WalletIcon,
          description: "Your code and link, your price, your bank, earnings.",
          badge: bankNeeded ? 1 : 0,
        },
      ],
    },
  ];
  if (canManage) {
    groups.push({
      label: "School",
      pages: [
        {
          id: "team",
          label: "Team",
          to: schoolPath(schoolId, "team"),
          icon: PeopleIcon,
          description: "The owner and admins, and each admin's branches.",
        },
        {
          id: "branches",
          label: "Branches",
          to: schoolPath(schoolId, "branches"),
          icon: PinIcon,
          description: "Add, rename, close.",
        },
        {
          id: "profile",
          label: "Profile",
          to: schoolPath(schoolId, "profile"),
          icon: SchoolIcon,
          description: "What learners read about you, logos, branch details.",
        },
      ],
    });
  }
  return groups;
}
