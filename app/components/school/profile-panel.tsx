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
 * The board's own look (car paint, roof board, posters) is made by DriveRush
 * and published from the console; this panel never changes it.
 */
import * as React from "react";
import { useFetcher } from "react-router";
import { HoneypotInputs } from "remix-utils/honeypot/react";

import { Button } from "~/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import {
  InputField,
  ServerFormProvider,
  TextareaField,
} from "~/components/ui/forms/server";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import type { Json } from "~/database/types";
import { useServerForm } from "~/lib/forms/use-server-form";
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

export function ProfilePanel({
  profile,
  logos,
  branches,
}: {
  profile: Profile;
  logos: { logo: string | null; logo_mono: string | null };
  branches: Branch[];
}) {
  return (
    <section id="profile" className="flex scroll-mt-20 flex-col gap-4">
      <h2 className="font-display text-[20px] font-bold">Profile</h2>
      <p className="m-0 max-w-2xl text-[14px] text-ink-2">
        What learners read about your school on DriveRush. Your cars on the
        board are made by DriveRush from your real ones: ask us to change them.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <LogoUpload
          kind="logo"
          label="Logo"
          hint="In colour, on a clear background. Shown beside your name."
          current={logos.logo}
        />
        <LogoUpload
          kind="logo_mono"
          label="White logo"
          hint="All white, on a clear background. Engraved on the board's brass plates."
          current={logos.logo_mono}
          dark
        />
      </div>
      <ProfileForm profile={profile} />
      {branches.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-[15px] font-semibold">Branch details</h3>
          <ul className="m-0 flex list-none flex-col divide-y divide-line rounded-lg border border-line bg-surface p-0">
            {branches.map((b) => (
              <BranchDetails
                key={`${b.id}:${b.address}:${b.phone}:${JSON.stringify(b.hours)}`}
                branch={b}
              />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function LogoUpload({
  kind,
  label,
  hint,
  current,
  dark = false,
}: {
  kind: "logo" | "logo_mono";
  label: string;
  hint: string;
  current: string | null;
  dark?: boolean;
}) {
  const fetcher = useFetcher<{ ok: boolean }>({ key: `upload-logo:${kind}` });
  const busy = fetcher.state !== "idle";
  const [problem, setProblem] = React.useState<string | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);
  React.useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.ok) formRef.current?.reset();
  }, [fetcher.state, fetcher.data]);
  return (
    <fetcher.Form
      ref={formRef}
      method="post"
      encType="multipart/form-data"
      className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4"
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
        size="sm"
        variant="paper"
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

function ProfileForm({ profile }: { profile: Profile }) {
  const { methods, fetcher, formRef, busy } = useServerForm({
    schema: UpdateProfileSchema,
    key: "update-profile",
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
  return (
    <ServerFormProvider methods={methods}>
      <fetcher.Form
        ref={formRef}
        method="post"
        onSubmit={methods.handleSubmit}
        noValidate
        className="grid gap-3 rounded-lg border border-line bg-surface p-4 sm:grid-cols-2"
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

function BranchDetails({ branch }: { branch: Branch }) {
  const weekday = dayOf(branch.hours, "mon");
  const sat = dayOf(branch.hours, "sat");
  const sun = dayOf(branch.hours, "sun");
  const { methods, fetcher, formRef, busy } = useServerForm({
    schema: UpdateBranchDetailsSchema,
    key: `branch-details:${branch.id}`,
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
  return (
    <li>
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-between rounded-none px-4 py-3"
          >
            <span className="font-semibold">{branch.name}</span>
            <span className="text-[13px] font-normal text-ink-3">
              {branch.address ?? "No address yet"}
            </span>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ServerFormProvider methods={methods}>
            <fetcher.Form
              ref={formRef}
              method="post"
              onSubmit={methods.handleSubmit}
              noValidate
              className="grid gap-3 px-4 pb-4 sm:grid-cols-2"
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
              <HoursRow
                label="Sunday"
                open="sunOpen"
                close="sunClose"
                busy={busy}
              />
              <p className="m-0 self-end text-[12.5px] text-ink-3 sm:col-span-2">
                Leave a day's times empty when the branch is closed.
              </p>
              <Button
                type="submit"
                size="sm"
                variant="paper"
                className="self-start"
                isLoading={busy}
              >
                Save branch details
              </Button>
            </fetcher.Form>
          </ServerFormProvider>
        </CollapsibleContent>
      </Collapsible>
    </li>
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
