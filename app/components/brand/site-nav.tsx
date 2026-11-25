/**
 * Shared top bar. On a phone it is the logo, the light/dark switch and the
 * account button (sign in, or the learner's initial): the
 * tab bar at the bottom does the moving around (`tab-bar.tsx`). On a wide
 * screen it carries the same four places as links, and one button that starts
 * the board course or carries on with it.
 */
import { Link, useLocation } from "react-router";

import { SITE_TABS, activeTab } from "~/lib/nav";

import { AccountButton } from "~/components/account/account-button";
import { CourseLabel } from "~/components/board/course-label";
import { useCourseStart } from "~/components/board/use-course-start";
import { AppBar, AppBarLink } from "~/components/brand/app-bar";
import { Icon } from "~/components/brand/icon";
import { ArrowRightIcon } from "~/components/brand/icons";
import { Logo } from "~/components/brand/logo";
import { Button } from "~/components/ui/button";

export function SiteNav() {
  const { pathname } = useLocation();
  const current = activeTab(pathname);
  const { href, label, ready, done } = useCourseStart();
  return (
    <AppBar
      brand={
        <Link to="/" aria-label="DriveRush home" className="outline-none">
          <Logo variant="plain" height={30} tight themed priority />
        </Link>
      }
      nav={
        <>
          {SITE_TABS.filter((tab) => tab.id !== "home").map((tab) => (
            <AppBarLink key={tab.id} asChild active={tab.id === current}>
              <Link to={tab.href}>{tab.label}</Link>
            </AppBarLink>
          ))}
        </>
      }
      trailing={
        <>
          <AccountButton />
          <Button
            variant="rush"
            size="sm"
            asChild
            className="hidden md:inline-flex"
          >
            <Link to={href}>
              <CourseLabel label={label} ready={ready} started={done > 0} />
              <Icon icon={ArrowRightIcon} size={14} className="dr-arrow" />
            </Link>
          </Button>
        </>
      }
    />
  );
}
