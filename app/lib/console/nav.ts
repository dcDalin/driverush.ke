/**
 * The console's map (thinkrush `site-map.ts`, much smaller): the side menu's
 * groups and pages. One list, so the menu, the top bar's title and the
 * overview's shortcuts never disagree.
 */
import {
  GridIcon,
  type IconDef,
  PeopleIcon,
  SchoolIcon,
  WalletIcon,
} from "~/components/brand/icons";

export type ConsoleBadges = { banks: number };

export type ConsolePage = {
  id: string;
  label: string;
  to: string;
  icon: IconDef;
  /** One line for the overview and the menu's tooltip. */
  description: string;
  /** A count beside the item: what is waiting for someone. */
  badge?: keyof ConsoleBadges;
  suOnly?: boolean;
};

export type ConsoleGroup = { label: string | null; pages: ConsolePage[] };

export const CONSOLE_HOME = "/console";

export const CONSOLE_NAV: ConsoleGroup[] = [
  {
    label: null,
    pages: [
      {
        id: "overview",
        label: "Overview",
        to: CONSOLE_HOME,
        icon: GridIcon,
        description: "What needs you, and how DriveRush is doing.",
      },
    ],
  },
  {
    label: "Schools",
    pages: [
      {
        id: "schools",
        label: "Schools",
        to: "/console/schools",
        icon: SchoolIcon,
        description:
          "Every driving school: set-up, hand-over, liveries, sponsorship.",
      },
    ],
  },
  {
    label: "Money",
    pages: [
      {
        id: "payments",
        label: "Payments",
        to: "/console/payments",
        icon: WalletIcon,
        description: "Every pass paid for, the month's totals, banks to check.",
        badge: "banks",
      },
    ],
  },
  {
    label: "Team",
    pages: [
      {
        id: "staff",
        label: "Staff",
        to: "/console/staff",
        icon: PeopleIcon,
        description: "Who holds a DriveRush staff role.",
        suOnly: true,
      },
    ],
  },
];

/** The menu for this person: su-only pages leave with their empty groups. */
export function consoleNavFor(su: boolean): ConsoleGroup[] {
  return CONSOLE_NAV.map((group) => ({
    ...group,
    pages: group.pages.filter((page) => su || !page.suOnly),
  })).filter((group) => group.pages.length > 0);
}

/** The page a path belongs to: the longest `to` it starts with. */
export function consolePageAt(pathname: string): ConsolePage | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  let best: ConsolePage | null = null;
  for (const page of CONSOLE_NAV.flatMap((group) => group.pages)) {
    const under =
      page.to === CONSOLE_HOME
        ? path === CONSOLE_HOME
        : path === page.to || path.startsWith(`${page.to}/`);
    if (under && (!best || page.to.length > best.to.length)) best = page;
  }
  return best;
}
