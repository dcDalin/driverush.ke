/**
 * The account menu's way into the rest of DriveRush (owner, 2026-11-26): the
 * learner's pass, the schools they own or help run, and the console for
 * staff. The places come from `/api/me/places` through a keyed fetcher, the
 * pass from the entitlement the menu already has.
 */
import * as React from "react";
import { Link, useFetcher } from "react-router";

import { Icon } from "~/components/brand/icon";
import {
  ChevronRightIcon,
  GridIcon,
  SettingsIcon,
  StarIcon,
} from "~/components/brand/icons";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { useEntitlement } from "~/lib/auth/entitlement";
import { passesOn } from "~/lib/board/use-paywall";
import type { loader } from "~/routes/api/me.places";

export const PLACES_PATH = "/api/me/places";

const DATE = new Intl.DateTimeFormat("en-KE", {
  day: "numeric",
  month: "short",
});

function Place({
  to,
  icon,
  children,
  badge,
  onGo,
}: {
  to: string;
  icon: typeof GridIcon;
  children: React.ReactNode;
  badge?: string;
  onGo: () => void;
}) {
  return (
    <Button
      asChild
      variant="ghost"
      size="sm"
      className="w-full justify-start gap-2 px-2"
    >
      <Link to={to} onClick={onGo} prefetch="intent">
        <Icon icon={icon} size={16} />
        <span className="min-w-0 flex-1 truncate text-left">{children}</span>
        {badge ? <Badge variant="outline">{badge}</Badge> : null}
        <Icon icon={ChevronRightIcon} size={14} className="text-ink-3" />
      </Link>
    </Button>
  );
}

export function MyPlaces({ onGo }: { onGo: () => void }) {
  const entitlement = useEntitlement();
  const places = useFetcher<typeof loader>({ key: "my-places" });

  React.useEffect(() => {
    if (places.state === "idle" && !places.data) places.load(PLACES_PATH);
  }, [places]);

  const schools = places.data?.schools ?? [];
  const staff = places.data?.staff ?? false;
  const pass = entitlement?.full_access ? entitlement.pass_ends_at : null;
  const offerPass = !pass && passesOn();
  if (!pass && !offerPass && !staff && schools.length === 0) return null;

  return (
    <nav
      aria-label="Your places"
      className="mb-3 flex flex-col gap-1 border-b border-line pb-3"
    >
      {pass ? (
        <p className="m-0 flex items-center gap-2 px-2 py-1 text-[13px] text-ink-2">
          <Icon icon={StarIcon} size={16} className="text-amber" />
          Full course until {DATE.format(new Date(pass))}
        </p>
      ) : offerPass ? (
        <Place to="/pass" icon={StarIcon} onGo={onGo}>
          Get the full course
        </Place>
      ) : null}
      {schools.map((school) => (
        <Place
          key={school.id}
          to={`/school/${school.id}`}
          icon={GridIcon}
          badge={school.role}
          onGo={onGo}
        >
          {school.name}
        </Place>
      ))}
      {staff ? (
        <Place to="/console" icon={SettingsIcon} onGo={onGo}>
          DriveRush console
        </Place>
      ) : null}
    </nav>
  );
}
