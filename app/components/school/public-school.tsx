/**
 * A school's own profile on its public page (owner, 2026-11-26): its logo,
 * tagline, about text and the ways to reach it, then each branch with its
 * address, map pin, phone and hours. What the school wrote on DriveRush, so
 * the page says so and dates nothing it cannot vouch for.
 */
import { Icon } from "~/components/brand/icon";
import {
  ArrowOutIcon,
  FacebookIcon,
  type IconDef,
  LinkIcon,
  MailIcon,
  PhoneIcon,
  PinIcon,
  WhatsappIcon,
  XIcon,
} from "~/components/brand/icons";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  clockTime,
  mapsHref,
  type PublicBranch,
  type PublicSchool,
  telHref,
  todayInKenya,
  whatsappHref,
} from "~/lib/school/public-profile";

const SOCIAL_ICON: Record<string, IconDef> = {
  facebook: FacebookIcon,
  x: XIcon,
};

function hostOf(url: string) {
  return url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
}

/** Logo, tagline, about and contacts, in the school's own words. */
export function SchoolOwnWords({ school }: { school: PublicSchool }) {
  return (
    <div
      className="not-prose my-5 flex flex-col gap-4 rounded-xl border border-t-4 border-line bg-surface p-4 sm:p-5"
      style={
        school.colors ? { borderTopColor: school.colors.paint } : undefined
      }
    >
      <div className="flex items-center gap-4">
        {school.logo ? (
          <span className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-white p-2 ring-1 ring-line">
            <img
              src={school.logo.src}
              width={school.logo.width}
              height={school.logo.height}
              alt={`${school.name} logo`}
              className="max-h-full max-w-full object-contain"
              loading="lazy"
              crossOrigin="anonymous"
            />
          </span>
        ) : null}
        <div className="flex min-w-0 flex-col gap-1">
          {school.tagline ? (
            <p className="m-0 font-display text-[18px] leading-snug font-semibold text-ink">
              {school.tagline}
            </p>
          ) : null}
        </div>
      </div>

      {school.about.map((para) => (
        <p key={para} className="m-0 text-[15px] leading-relaxed text-ink-2">
          {para}
        </p>
      ))}

      <div className="flex flex-wrap gap-2">
        {school.phone ? (
          <Button asChild size="sm" variant="rush">
            <a href={telHref(school.phone)}>
              <Icon icon={PhoneIcon} size={16} />
              Call {school.phone}
            </a>
          </Button>
        ) : null}
        {school.whatsapp ? (
          <Button asChild size="sm" variant="paper">
            <a
              href={whatsappHref(school.whatsapp, school.name)}
              target="_blank"
              rel="noopener"
            >
              <Icon icon={WhatsappIcon} size={16} />
              WhatsApp
            </a>
          </Button>
        ) : null}
        {school.email ? (
          <Button asChild size="sm" variant="paper">
            <a href={`mailto:${school.email}`}>
              <Icon icon={MailIcon} size={16} />
              Email
            </a>
          </Button>
        ) : null}
        {school.website ? (
          <Button asChild size="sm" variant="paper">
            <a href={school.website} target="_blank" rel="noopener">
              <Icon icon={ArrowOutIcon} size={16} />
              {hostOf(school.website)}
            </a>
          </Button>
        ) : null}
        {school.socials.map((s) => (
          <Button key={s.network} asChild size="sm" variant="ghost">
            <a href={s.url} target="_blank" rel="noopener">
              <Icon icon={SOCIAL_ICON[s.network] ?? LinkIcon} size={16} />
              {s.label}
            </a>
          </Button>
        ))}
      </div>
      <p className="m-0 text-[12px] text-ink-3">
        Written by the school on DriveRush. Confirm fees and dates with the
        school.
      </p>
    </div>
  );
}

function Hours({ branch }: { branch: PublicBranch }) {
  if (branch.week.length === 0) return null;
  const today = todayInKenya();
  return (
    <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-[13px]">
      {branch.week.map((d) => (
        <div key={d.key} className="contents">
          <dt
            className={
              d.key === today ? "font-semibold text-ink" : "text-ink-3"
            }
          >
            {d.day}
          </dt>
          <dd
            className={
              d.key === today ? "m-0 font-semibold text-ink" : "m-0 text-ink-2"
            }
          >
            {d.hours
              ? `${clockTime(d.hours.open)} to ${clockTime(d.hours.close)}`
              : "Closed"}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Each open branch: where it is, how to call it, when it is open. */
export function SchoolBranches({ school }: { school: PublicSchool }) {
  return (
    <ul className="not-prose my-5 grid list-none gap-3 p-0 sm:grid-cols-2">
      {school.branches.map((b) => (
        <li
          key={b.name}
          className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4"
        >
          <div className="flex flex-col gap-1">
            <p className="m-0 flex flex-wrap items-center gap-2 font-semibold text-ink">
              {b.name}
              {b.town && b.town !== b.name ? (
                <Badge variant="outline">{b.town}</Badge>
              ) : null}
            </p>
            {b.address ? (
              <p className="m-0 text-[14px] text-ink-2">{b.address}</p>
            ) : null}
          </div>
          <Hours branch={b} />
          {b.pin || b.phone ? (
            <div className="mt-auto flex flex-wrap gap-2">
              {b.pin ? (
                <Button asChild size="sm" variant="paper">
                  <a href={mapsHref(b.pin)} target="_blank" rel="noopener">
                    <Icon icon={PinIcon} size={16} />
                    Map and directions
                  </a>
                </Button>
              ) : null}
              {b.phone ? (
                <Button asChild size="sm" variant="ghost">
                  <a href={telHref(b.phone)}>
                    <Icon icon={PhoneIcon} size={16} />
                    {b.phone}
                  </a>
                </Button>
              ) : null}
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
