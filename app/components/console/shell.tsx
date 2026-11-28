/**
 * The dashboard frame shared by the console and a school's dashboard
 * (thinkrush `admin-layout` + `sidebar`): a side menu
 * that stays put on a wide screen and slides in from a button on a phone, a
 * top bar that says where you are, and the page primitives every dashboard
 * page is built from (`PageHeader`, `Section`, `StatTile`), so spacing and
 * type stay the same from page to page.
 */
import * as React from "react";
import { Link, NavLink, useLocation } from "react-router";
import { toast } from "sonner";

import { Icon } from "~/components/brand/icon";
import {
  ArrowOutIcon,
  ArrowRightIcon,
  type IconDef,
  MenuIcon,
  SignOutIcon,
} from "~/components/brand/icons";
import { Logo } from "~/components/brand/logo";
import { ThemeToggle } from "~/components/brand/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";
import { signOut, useSession } from "~/lib/auth/session";
import { whoIs } from "~/lib/auth/who-is";
import { type ConsoleBadges, consoleNavFor } from "~/lib/console/nav";
import { cn } from "~/lib/utils";

/** One page in a dashboard's side menu. */
export type DashPage = {
  id: string;
  label: string;
  to: string;
  icon: IconDef;
  /** One line for the menu's tooltip. */
  description: string;
  /** A count beside the item: what is waiting for someone. */
  badge?: number;
};

export type DashGroup = { label: string | null; pages: DashPage[] };

/** The page a path belongs to: the longest `to` it is at or under. */
export function dashPageAt(
  groups: DashGroup[],
  home: string,
  pathname: string,
): DashPage | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  let best: DashPage | null = null;
  for (const page of groups.flatMap((group) => group.pages)) {
    const under =
      page.to === home
        ? path === home
        : path === page.to || path.startsWith(`${page.to}/`);
    if (under && (!best || page.to.length > best.to.length)) best = page;
  }
  return best;
}

type ShellProps = {
  /** The dashboard's first page, and what the breadcrumb starts with. */
  home: string;
  /** The breadcrumb's first word: "Console", or the school's name. */
  title: string;
  /** The small tag beside the logo. */
  tag: string;
  groups: DashGroup[];
  /** Under the person's name in the menu's foot. */
  roleLabel: string;
  children: React.ReactNode;
};

/** The console's frame: its own menu for this person, with live badges. */
export function ConsoleShell({
  su,
  badges,
  children,
}: {
  su: boolean;
  badges: ConsoleBadges;
  children: React.ReactNode;
}) {
  const groups: DashGroup[] = consoleNavFor(su).map((group) => ({
    label: group.label,
    pages: group.pages.map((page) => ({
      ...page,
      badge: page.badge ? badges[page.badge] : 0,
    })),
  }));
  return (
    <DashShell
      home="/console"
      title="Console"
      tag="Console"
      groups={groups}
      roleLabel={su ? "DriveRush su" : "DriveRush admin"}
    >
      {children}
    </DashShell>
  );
}

export function DashShell({
  home,
  title,
  tag,
  groups,
  roleLabel,
  children,
}: ShellProps) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const { pathname } = useLocation();
  const here = dashPageAt(groups, home, pathname);
  const menu = { home, tag, groups, roleLabel, here };
  return (
    <div className="min-h-screen overflow-x-clip bg-paper-2 text-ink">
      <aside className="hidden border-r border-line bg-surface lg:fixed lg:inset-y-0 lg:z-30 lg:flex lg:w-60 lg:flex-col">
        <SideMenu {...menu} />
      </aside>
      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur sm:px-6">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="paper"
                size="icon-sm"
                className="lg:hidden"
                aria-label="Open the menu"
              >
                <Icon icon={MenuIcon} size={16} />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <SheetBody className="flex h-full flex-col p-0">
                <SideMenu {...menu} onGo={() => setMenuOpen(false)} />
              </SheetBody>
            </SheetContent>
          </Sheet>
          {/* On a phone only the page's own name: the menu button is beside
              it, and the dashboard's name would squeeze it to a few letters. */}
          <p className="m-0 flex min-w-0 items-center gap-2 text-[13px] text-ink-3">
            <Link
              to={home}
              className={cn(
                "truncate hover:text-ink",
                here && here.to !== home && "hidden sm:inline",
              )}
            >
              {title}
            </Link>
            {here && here.to !== home ? (
              <>
                <span aria-hidden className="hidden sm:inline">
                  /
                </span>
                <Link
                  to={here.to}
                  className="truncate font-semibold text-ink hover:text-rush"
                >
                  {here.label}
                </Link>
              </>
            ) : null}
          </p>
          <div className="ml-auto flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/" aria-label="View site">
                <span className="hidden sm:inline">View site</span>
                <Icon icon={ArrowOutIcon} size={14} />
              </Link>
            </Button>
            <ThemeToggle />
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-4 sm:gap-6 sm:px-6 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

function SideMenu({
  home,
  tag,
  groups,
  roleLabel,
  here,
  onGo,
}: {
  home: string;
  tag: string;
  groups: DashGroup[];
  roleLabel: string;
  here: DashPage | null;
  onGo?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <Link
        to={home}
        onClick={onGo}
        aria-label={`${tag} overview`}
        className="flex h-14 shrink-0 items-center gap-2.5 border-b border-line px-4 outline-none"
      >
        <Logo variant="plain" height={26} tight themed />
        <span className="rounded-md border border-line px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.12em] text-ink-3 uppercase">
          {tag}
        </span>
      </Link>
      <nav
        aria-label={tag}
        className="flex flex-1 flex-col gap-4 overflow-y-auto px-2 py-4"
      >
        {groups.map((group) => (
          <div key={group.label ?? "top"} className="flex flex-col gap-0.5">
            {group.label ? (
              <p className="m-0 px-3 pb-1 text-[10px] font-semibold tracking-[0.12em] text-ink-3 uppercase">
                {group.label}
              </p>
            ) : null}
            {group.pages.map((page) => {
              const active = here?.id === page.id;
              const waiting = page.badge ?? 0;
              return (
                <NavLink
                  key={page.id}
                  to={page.to}
                  end={page.to === home}
                  onClick={onGo}
                  prefetch="intent"
                  title={page.description}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex items-center gap-3 rounded-md px-3 py-2 text-[14px] outline-none",
                    "transition-colors duration-100 ease-snap focus-visible:bg-paper-2",
                    active
                      ? "bg-paper-2 font-semibold text-ink"
                      : "text-ink-2 hover:bg-paper-2 hover:text-ink",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "absolute inset-y-1.5 left-0 w-0.5 rounded-full",
                      active ? "bg-rush" : "bg-transparent",
                    )}
                  />
                  <Icon icon={page.icon} size={17} />
                  <span className="flex-1 truncate">{page.label}</span>
                  {waiting > 0 ? (
                    <span
                      className="rounded-full bg-rush px-1.5 py-0.5 text-[10.5px] leading-none font-bold text-primary-foreground tabular-nums"
                      aria-label={`${waiting} waiting`}
                    >
                      {waiting}
                    </span>
                  ) : null}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>
      <AccountFooter roleLabel={roleLabel} />
    </div>
  );
}

function AccountFooter({ roleLabel }: { roleLabel: string }) {
  const session = useSession();
  const [busy, setBusy] = React.useState(false);
  const who = session.status === "signed-in" ? whoIs(session.user) : null;
  const email = session.status === "signed-in" ? session.user.email : null;
  return (
    <div className="flex shrink-0 items-center gap-2.5 border-t border-line p-3">
      <Avatar className="size-8">
        {who?.picture && (
          <AvatarImage src={who.picture} alt="" referrerPolicy="no-referrer" />
        )}
        <AvatarFallback>{who?.initial ?? "?"}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="m-0 truncate text-[13px] font-semibold text-ink">
          {who?.fullName ?? email ?? "Signed in"}
        </p>
        <p className="m-0 truncate text-[11.5px] text-ink-3">{roleLabel}</p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Sign out"
        title="Sign out"
        isLoading={busy}
        onClick={async () => {
          setBusy(true);
          const { flushProgress } = await import("~/lib/progress/sync");
          await flushProgress();
          await signOut();
          toast("You are signed out.");
        }}
      >
        {!busy && <Icon icon={SignOutIcon} size={16} />}
      </Button>
    </div>
  );
}

export type RouteTab = {
  label: string;
  to: string;
  /** Only this address, not the ones under it (a section's first tab). */
  end?: boolean;
  /** What is waiting on that tab. */
  badge?: React.ReactNode;
};

/**
 * Tabs that are pages: each is a link, so the address says which one is
 * open, the back button works, and a modal under a tab keeps it lit.
 */
export function RouteTabs({
  label,
  tabs,
}: {
  label: string;
  tabs: RouteTab[];
}) {
  // On a phone the tabs scroll sideways: keep the open one in sight.
  const navRef = React.useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  React.useEffect(() => {
    navRef.current
      ?.querySelector<HTMLElement>("[aria-current=page]")
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [pathname]);
  return (
    <nav
      ref={navRef}
      aria-label={label}
      className="-mx-4 shrink-0 overflow-x-auto border-b border-line px-4 [scrollbar-width:none] sm:mx-0 sm:px-0"
    >
      <ul className="m-0 flex list-none gap-1 p-0">
        {tabs.map((tab) => (
          <li key={tab.to}>
            <NavLink
              to={tab.to}
              end={tab.end}
              prefetch="intent"
              preventScrollReset
              className={({ isActive }) =>
                cn(
                  "-mb-px flex h-10 items-center gap-1.5 border-b-2 px-3 text-[14px] whitespace-nowrap outline-none",
                  "transition-colors duration-100 focus-visible:bg-paper-2",
                  isActive
                    ? "border-rush font-semibold text-ink"
                    : "border-transparent text-ink-2 hover:text-ink",
                )
              }
            >
              {tab.label}
              {tab.badge}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** A page's title block: what this page is, and its one main action. */
export function PageHeader({
  title,
  description,
  actions,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  /** Under the title: badges, a status control. */
  children?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="m-0 font-display text-[24px] leading-tight font-bold tracking-tight sm:text-[28px]">
            {title}
          </h1>
          {description ? (
            <p className="m-0 mt-1 max-w-2xl text-[14px] text-ink-2">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        ) : null}
      </div>
      {children}
    </header>
  );
}

/** A titled block on a page, with an optional link or action on the right. */
export function Section({
  title,
  description,
  actions,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <h2 className="m-0 font-display text-[16px] font-bold tracking-tight">
            {title}
          </h2>
          {description ? (
            <p className="m-0 text-[13px] text-ink-3">{description}</p>
          ) : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

const TONE = {
  neutral: "text-ink",
  good: "text-success-strong",
  warn: "text-warning-strong",
} as const;

/**
 * One number with what it means and where it is explained: the whole tile
 * is a link into the page that owns the number.
 */
export function StatTile({
  label,
  value,
  note,
  icon,
  to,
  tone = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  note?: React.ReactNode;
  icon?: IconDef;
  to?: string;
  tone?: keyof typeof TONE;
}) {
  const body = (
    <>
      <span className="flex items-center justify-between gap-2 text-[11px] font-semibold tracking-[0.04em] text-ink-3 uppercase sm:tracking-[0.08em]">
        <span className="flex items-center gap-1.5">
          {icon ? <Icon icon={icon} size={14} /> : null}
          {label}
        </span>
        {to ? (
          <Icon
            icon={ArrowRightIcon}
            size={14}
            // A hover hint: a phone has no hover, so it gives the label the room.
            className="hidden opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 sm:block"
          />
        ) : null}
      </span>
      <span
        className={cn(
          "font-display text-[26px] leading-none font-bold tabular-nums",
          TONE[tone],
        )}
      >
        {value}
      </span>
      {note ? <span className="text-[12.5px] text-ink-3">{note}</span> : null}
    </>
  );
  const className =
    "group flex flex-col gap-2 rounded-lg border border-line bg-surface p-3 outline-none sm:p-4";
  return to ? (
    <Link
      to={to}
      prefetch="intent"
      className={cn(
        className,
        "transition-colors duration-100 hover:border-ink/25 focus-visible:border-rush",
      )}
    >
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
