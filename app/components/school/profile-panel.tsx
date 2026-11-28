/**
 * The school's profile, for its owner (and DriveRush staff): what learners
 * read about it on the site and see on the board's credits.
 *
 * - Logos: the colour one (credits, the site's row of schools) and the white
 *   one (brass plates). Sent as a file to the route action, which makes the
 *   sizes and stores them in Supabase Storage.
 * - Profile: tagline, about, contacts, social links, brand colours.
 * - Each branch's address, map pin, phone and opening hours.
 *
 * The page (`ProfilePanel`) shows what is saved and links; each form opens
 * in its own modal route (`profile/edit`, `profile/logo/:kind`,
 * `profile/branches/:branchId`), posts to it (`action`) and closes back
 * (`closeTo`) once saved.
 *
 * The board's own look (car paint, roof board, posters) is made by DriveRush
 * and published from the console; this panel never changes it.
 */
import * as React from "react";
import { Link, useFetcher } from "react-router";
import { HoneypotInputs } from "remix-utils/honeypot/react";

import { Icon } from "~/components/brand/icon";
import { EditIcon } from "~/components/brand/icons";
import { useCloseWhenDone } from "~/components/console/route-modal";
import { Button } from "~/components/ui/button";
import {
  InputField,
  ServerFormProvider,
  TextareaField,
} from "~/components/ui/forms/server";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import type { Json } from "~/database/types";
import { useServerForm } from "~/lib/forms/use-server-form";
import { schoolPath } from "~/lib/school/nav";
import {
  LOGO_MAX_BYTES,
  LOGO_TYPES,
  UpdateBranchDetailsSchema,
  UpdateProfileSchema,
} from "~/schemas/school";

type Profile = {
  tagline: string | null;
  about: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website_url: string | null;
  socials: Json;
  brand_paint: string | null;
  brand_ink: string | null;
} | null;

type Branch = {
  id: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  hours: Json | null;
};

export type SchoolProfile = Profile;
export type ProfileBranch = Branch;

export const LOGOS = {
  logo: {
    label: "Logo",
    hint: "In colour, on a clear background. Shown beside your name.",
    dark: false,
  },
  logo_mono: {
    label: "White logo",
    hint: "All white, on a clear background. Engraved on the board's brass plates.",
    dark: true,
  },
} as const;

export type LogoKind = keyof typeof LOGOS;

function EditLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Button asChild size="sm" variant="paper" className="shrink-0">
      <Link to={to} preventScrollReset>
        <Icon icon={EditIcon} size={14} />
        {children}
      </Link>
    </Button>
  );
}

function LogoBox({ current, dark }: { current: string | null; dark: boolean }) {
  return (
    <div
      className={
        dark
          ? "flex h-20 items-center justify-center rounded-md bg-kenya-black p-3"
          : "flex h-20 items-center justify-center rounded-md border border-line bg-white p-3"
      }
    >
      {current ? (
        <img
          src={current}
          alt=""
          className="max-h-full max-w-full object-contain"
        />
      ) : (
        <span
          className={
            dark ? "text-[13px] text-white/70" : "text-[13px] text-ink-3"
          }
        >
          None yet
        </span>
      )}
    </div>
  );
}

const HOURS_DAYS = [
  ["mon", "Weekdays"],
  ["sat", "Sat"],
  ["sun", "Sun"],
] as const;

/** "Weekdays 08:00 to 17:00 · Sat 08:00 to 13:00", or null with none set. */
function hoursLine(hours: Json | null) {
  const parts = HOURS_DAYS.flatMap(([day, label]) => {
    const open = dayOf(hours, day);
    return open ? [`${label} ${open.open} to ${open.close}`] : [];
  });
  return parts.length ? parts.join(" · ") : null;
}

export function ProfilePanel({
  schoolId,
  profile,
  logos,
  branches,
}: {
  schoolId: string;
  profile: Profile;
  logos: { logo: string | null; logo_mono: string | null };
  branches: Branch[];
}) {
  const to = (page: string) => schoolPath(schoolId, `profile/${page}`);
  const contacts = [
    profile?.phone,
    profile?.whatsapp ? `WhatsApp ${profile.whatsapp}` : null,
    profile?.email,
    profile?.website_url,
  ].filter(Boolean);
  return (
    <section id="profile" className="flex scroll-mt-20 flex-col gap-6">
      <h2 className="sr-only">Profile</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {(Object.keys(LOGOS) as LogoKind[]).map((kind) => (
          <div
            key={kind}
            className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4"
          >
            <LogoBox current={logos[kind]} dark={LOGOS[kind].dark} />
            <div className="flex items-start justify-between gap-3">
              <p className="m-0 text-[13px] text-ink-3">
                <strong className="block text-[14px] text-ink">
                  {LOGOS[kind].label}
                </strong>
                {LOGOS[kind].hint}
              </p>
              <EditLink to={to(`logo/${kind}`)}>
                {logos[kind] ? "Change" : "Upload"}
              </EditLink>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="m-0 text-[15px] font-semibold">About your school</h3>
          <EditLink to={to("edit")}>Edit profile</EditLink>
        </div>
        {profile?.tagline || profile?.about ? (
          <>
            {profile.tagline ? (
              <p className="m-0 text-[15px] font-semibold">{profile.tagline}</p>
            ) : null}
            {profile.about ? (
              <p className="m-0 line-clamp-4 text-[14px] whitespace-pre-line text-ink-2">
                {profile.about}
              </p>
            ) : null}
          </>
        ) : (
          <p className="m-0 text-[14px] text-ink-3">
            No tagline or about text yet. Learners read this before they choose
            a school.
          </p>
        )}
        <p className="m-0 text-[13px] text-ink-3">
          {contacts.length ? contacts.join(" · ") : "No contacts yet."}
        </p>
      </div>

      {branches.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="m-0 text-[15px] font-semibold">Branch details</h3>
          <ul className="m-0 flex list-none flex-col divide-y divide-line rounded-lg border border-line bg-surface p-0">
            {branches.map((b) => (
              <li
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <span className="min-w-0">
                  <span className="block font-semibold">{b.name}</span>
                  <span className="block text-[13px] text-ink-3">
                    {[
                      b.address ?? "No address yet",
                      b.phone,
                      hoursLine(b.hours),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <EditLink to={to(`branches/${b.id}`)}>Edit details</EditLink>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export function LogoUpload({
  kind,
  current,
  action,
  closeTo,
}: {
  kind: LogoKind;
  current: string | null;
  action: string;
  closeTo: string;
}) {
  const { label, hint, dark } = LOGOS[kind];
  const fetcher = useFetcher<{ ok: boolean }>({ key: `upload-logo:${kind}` });
  const busy = fetcher.state !== "idle";
  const [problem, setProblem] = React.useState<string | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);
  useCloseWhenDone(fetcher, closeTo);
  return (
    <fetcher.Form
      ref={formRef}
      method="post"
      action={action}
      encType="multipart/form-data"
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        const file = new FormData(event.currentTarget).get("file");
        const bad =
          !(file instanceof File) || file.size === 0
            ? "Choose a picture."
            : file.size > LOGO_MAX_BYTES
              ? "At most 5 MB."
              : !(LOGO_TYPES as readonly string[]).includes(file.type)
                ? "A PNG, JPEG or WebP picture."
                : null;
        setProblem(bad);
        if (bad) event.preventDefault();
      }}
    >
      <HoneypotInputs />
      <input type="hidden" name="intent" value="upload-logo" />
      <input type="hidden" name="kind" value={kind} />
      <LogoBox current={current} dark={dark} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`file-${kind}`}>{label}</Label>
        <Input
          id={`file-${kind}`}
          name="file"
          type="file"
          accept={LOGO_TYPES.join(",")}
          disabled={busy}
          aria-invalid={problem ? true : undefined}
          aria-describedby={`file-${kind}-hint`}
        />
        <p id={`file-${kind}-hint`} className="m-0 text-[12.5px] text-ink-3">
          {problem ?? hint}
        </p>
      </div>
      <Button
        type="submit"
        variant="rush"
        className="self-start"
        isLoading={busy}
      >
        Upload
      </Button>
    </fetcher.Form>
  );
}

function socialOf(socials: Json, network: string) {
  return socials && typeof socials === "object" && !Array.isArray(socials)
    ? String((socials as Record<string, Json>)[network] ?? "")
    : "";
}

export function ProfileForm({
  profile,
  action,
  closeTo,
}: {
  profile: Profile;
  action: string;
  closeTo: string;
}) {
  const { methods, fetcher, formRef, busy } = useServerForm({
    schema: UpdateProfileSchema,
    key: "update-profile",
    action,
    defaultValues: {
      intent: "update-profile",
      tagline: profile?.tagline ?? "",
      about: profile?.about ?? "",
      phone: profile?.phone ?? "",
      whatsapp: profile?.whatsapp ?? "",
      email: profile?.email ?? "",
      websiteUrl: profile?.website_url ?? "",
      facebook: socialOf(profile?.socials ?? null, "facebook"),
      instagram: socialOf(profile?.socials ?? null, "instagram"),
      tiktok: socialOf(profile?.socials ?? null, "tiktok"),
      x: socialOf(profile?.socials ?? null, "x"),
      youtube: socialOf(profile?.socials ?? null, "youtube"),
      brandPaint: profile?.brand_paint ?? "",
      brandInk: profile?.brand_ink ?? "",
    },
  });
  useCloseWhenDone(fetcher, closeTo);
  return (
    <ServerFormProvider methods={methods}>
      <fetcher.Form
        ref={formRef}
        method="post"
        action={action}
        onSubmit={methods.handleSubmit}
        noValidate
        className="grid gap-3 sm:grid-cols-2"
      >
        <HoneypotInputs />
        <InputField
          name="tagline"
          label="Tagline"
          className="sm:col-span-2"
          disabled={busy}
          inputProps={{ placeholder: "Learn to drive in Nairobi" }}
        />
        <TextareaField
          name="about"
          label="About the school"
          className="sm:col-span-2"
          disabled={busy}
        />
        <InputField
          name="phone"
          label="Phone"
          disabled={busy}
          inputProps={{
            type: "tel",
            inputMode: "tel",
            placeholder: "0712 345 678",
          }}
        />
        <InputField
          name="whatsapp"
          label="WhatsApp"
          disabled={busy}
          inputProps={{ type: "tel", inputMode: "tel" }}
        />
        <InputField
          name="email"
          label="Email"
          disabled={busy}
          inputProps={{ type: "email", inputMode: "email" }}
        />
        <InputField
          name="websiteUrl"
          label="Website"
          description='Your "Book lessons" link.'
          disabled={busy}
          inputProps={{
            type: "url",
            inputMode: "url",
            placeholder: "https://",
          }}
        />
        <InputField
          name="facebook"
          label="Facebook"
          disabled={busy}
          inputProps={{ type: "url", placeholder: "https://facebook.com/..." }}
        />
        <InputField
          name="instagram"
          label="Instagram"
          disabled={busy}
          inputProps={{ type: "url", placeholder: "https://instagram.com/..." }}
        />
        <InputField
          name="tiktok"
          label="TikTok"
          disabled={busy}
          inputProps={{ type: "url", placeholder: "https://tiktok.com/@..." }}
        />
        <InputField
          name="x"
          label="X"
          disabled={busy}
          inputProps={{ type: "url", placeholder: "https://x.com/..." }}
        />
        <InputField
          name="youtube"
          label="YouTube"
          disabled={busy}
          inputProps={{ type: "url", placeholder: "https://youtube.com/@..." }}
        />
        <div className="grid grid-cols-2 gap-3">
          <InputField
            name="brandPaint"
            label="Brand colour"
            disabled={busy}
            inputProps={{ placeholder: "#f4a20c" }}
          />
          <InputField
            name="brandInk"
            label="Text colour"
            disabled={busy}
            inputProps={{ placeholder: "#1d2fc2" }}
          />
        </div>
        <Button
          type="submit"
          variant="rush"
          className="self-start sm:col-span-2"
          isLoading={busy}
        >
          Save profile
        </Button>
      </fetcher.Form>
    </ServerFormProvider>
  );
}

type Day = { open: string; close: string } | null;

function dayOf(hours: Json | null, day: string): Day {
  if (!hours || typeof hours !== "object" || Array.isArray(hours)) return null;
  const value = (hours as Record<string, Json>)[day];
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const { open, close } = value as Record<string, Json>;
  return typeof open === "string" && typeof close === "string"
    ? { open, close }
    : null;
}

export function BranchDetails({
  branch,
  action,
  closeTo,
}: {
  branch: Branch;
  action: string;
  closeTo: string;
}) {
  const weekday = dayOf(branch.hours, "mon");
  const sat = dayOf(branch.hours, "sat");
  const sun = dayOf(branch.hours, "sun");
  const { methods, fetcher, formRef, busy } = useServerForm({
    schema: UpdateBranchDetailsSchema,
    key: `branch-details:${branch.id}`,
    action,
    defaultValues: {
      intent: "update-branch-details",
      branchId: branch.id,
      address: branch.address ?? "",
      lat: branch.lat === null ? "" : String(branch.lat),
      lng: branch.lng === null ? "" : String(branch.lng),
      phone: branch.phone ?? "",
      weekdaysOpen: weekday?.open ?? "",
      weekdaysClose: weekday?.close ?? "",
      satOpen: sat?.open ?? "",
      satClose: sat?.close ?? "",
      sunOpen: sun?.open ?? "",
      sunClose: sun?.close ?? "",
    },
  });
  useCloseWhenDone(fetcher, closeTo);
  return (
    <ServerFormProvider methods={methods}>
      <fetcher.Form
        ref={formRef}
        method="post"
        action={action}
        onSubmit={methods.handleSubmit}
        noValidate
        className="grid gap-3 sm:grid-cols-2"
      >
        <HoneypotInputs />
        <InputField
          name="address"
          label="Address"
          className="sm:col-span-2"
          disabled={busy}
          inputProps={{ placeholder: "Moi Avenue, opposite the bank" }}
        />
        <InputField
          name="lat"
          label="Map pin: latitude"
          description="From Google Maps: press on the place, copy the first number."
          disabled={busy}
          inputProps={{ inputMode: "decimal", placeholder: "-1.2841" }}
        />
        <InputField
          name="lng"
          label="Map pin: longitude"
          disabled={busy}
          inputProps={{ inputMode: "decimal", placeholder: "36.8233" }}
        />
        <InputField
          name="phone"
          label="Branch phone"
          disabled={busy}
          inputProps={{ type: "tel", inputMode: "tel" }}
        />
        <span className="hidden sm:block" />
        <HoursRow
          label="Monday to Friday"
          open="weekdaysOpen"
          close="weekdaysClose"
          busy={busy}
        />
        <HoursRow
          label="Saturday"
          open="satOpen"
          close="satClose"
          busy={busy}
        />
        <HoursRow label="Sunday" open="sunOpen" close="sunClose" busy={busy} />
        <p className="m-0 self-end text-[12.5px] text-ink-3 sm:col-span-2">
          Leave a day's times empty when the branch is closed.
        </p>
        <Button
          type="submit"
          variant="rush"
          className="self-start"
          isLoading={busy}
        >
          Save branch details
        </Button>
      </fetcher.Form>
    </ServerFormProvider>
  );
}

function HoursRow({
  label,
  open,
  close,
  busy,
}: {
  label: string;
  open: string;
  close: string;
  busy: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:col-span-2 sm:grid-cols-[10rem_1fr_1fr] sm:items-start">
      <span className="col-span-2 pt-1 text-[14px] font-semibold sm:col-span-1 sm:pt-7">
        {label}
      </span>
      <InputField
        name={open}
        label="Opens"
        disabled={busy}
        inputProps={{ type: "time" }}
      />
      <InputField
        name={close}
        label="Closes"
        disabled={busy}
        inputProps={{ type: "time" }}
      />
    </div>
  );
}
