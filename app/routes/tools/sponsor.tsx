/**
 * Checks a sponsoring driving school before it goes live: its car paint flat
 * and on the car (with the board camera's own views), its logo on the brass
 * plate and painted on the board, and the lines and card that name it.
 *
 * `?id=<school>` picks the school. See `~/lib/board/sponsors` for how to add one.
 */
import * as React from "react";
import { Link, useSearchParams } from "react-router";

import type { Route } from "./+types/sponsor";

import { fullBoardSvg } from "~/lib/board/full-board";
import { BOARD_CARS, sizeOf, type BoardCarId } from "~/lib/board/cars";
import { SPONSORS, sponsorById } from "~/lib/board/sponsors";
import { cn } from "~/lib/utils";

import { Button } from "~/components/ui/button";
import {
  SponsorCredit,
  SponsorReadyCard,
} from "~/components/board/sponsor-credit";
import type { CarView } from "~/components/board/sponsor-car-canvas";

const SponsorCarCanvas = React.lazy(
  () => import("~/components/board/sponsor-car-canvas"),
);

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Sponsor check · DriveRush Tools" },
    { name: "robots", content: "noindex,nofollow" },
  ];
}

/** The board camera looks down at 40 to 47 degrees; the car turns under it. */
const VIEWS: { label: string; view: CarView }[] = [
  { label: "Left side", view: { heading: -90, tilt: 8, dist: 9 } },
  { label: "Right side", view: { heading: 90, tilt: 8, dist: 9 } },
  { label: "Seat, nose away", view: { heading: 0, tilt: 44, dist: 11 } },
  { label: "Seat, nose to you", view: { heading: 180, tilt: 44, dist: 11 } },
  { label: "Seat, from its left", view: { heading: -60, tilt: 40, dist: 11 } },
  { label: "Seat, from its right", view: { heading: 60, tilt: 47, dist: 11 } },
  { label: "From above", view: { heading: 0, tilt: 89, dist: 9 } },
];

/** The part of the board around the sponsor's field. */
const NEAR_SPOT = { x0: -59.7, x1: 30, z0: -20, z1: 64.3 };

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8 border-t border-line pt-5">
      <h2 className="m-0 font-display text-[22px] font-bold tracking-tight">
        {title}
      </h2>
      {note && (
        <p className="m-0 mt-1.5 max-w-3xl text-[14px] leading-snug text-ink-2">
          {note}
        </p>
      )}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function PlatePreview({ logo }: { logo: string }) {
  const [src, setSrc] = React.useState<string | null>(null);
  React.useEffect(() => {
    let alive = true;
    Promise.all([
      import("~/components/board/board-sponsor"),
      new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = logo;
      }),
    ])
      .then(([mod, image]) => {
        if (!alive) return;
        const texture = mod.sponsoredPlate(image);
        setSrc((texture.image as HTMLCanvasElement).toDataURL());
        texture.dispose();
      })
      .catch(() => setSrc(null));
    return () => {
      alive = false;
    };
  }, [logo]);
  return src ? (
    <img src={src} alt="The brass plate" className="w-full max-w-3xl" />
  ) : (
    <p className="text-ink-2">Loading the plate…</p>
  );
}

export default function SponsorTool() {
  const [params, setParams] = useSearchParams();
  const sponsor = sponsorById(params.get("id")) ?? SPONSORS[0] ?? null;
  const [view, setView] = React.useState(VIEWS[2].view);
  const [overlay, setOverlay] = React.useState(false);
  const [car, setCar] = React.useState<BoardCarId>("saloon");
  // The wheels turning and steering, to check them on each car.
  // A long vehicle is looked at from further back.
  const carView = React.useMemo(
    () => ({
      ...view,
      dist: view.dist * Math.max(1, sizeOf(car).length / 4.3),
    }),
    [view, car],
  );
  const [roll, setRoll] = React.useState(false);
  const [steer, setSteer] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  if (!sponsor) return <p>No schools in `app/lib/board/sponsors.ts` yet.</p>;
  const paint = sponsor.livery?.cars[car];
  const wrapFull = paint?.hi;
  const template = `/assets/board/sponsors/${car}-template.svg`;

  return (
    <div>
      <header className="border-b border-line pb-6">
        <span className="eyebrow text-ink">Internal · sponsors</span>
        <h1 className="m-0 mt-3 font-display text-[clamp(32px,5vw,52px)] leading-[0.95] font-semibold tracking-tighter">
          {sponsor.school}
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-snug text-ink-2">
          {sponsor.live
            ? "Live: learners can be given this school."
            : "Not live: only shown with ?sponsor=" + sponsor.id + "."}{" "}
          Check every part below before setting it live.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {SPONSORS.map((s) => (
            <Button
              key={s.id}
              variant={s.id === sponsor.id ? "ink" : "paper"}
              onClick={() => setParams({ id: s.id })}
            >
              {s.school}
            </Button>
          ))}
          <Button variant="rush" asChild>
            <Link to={`/model-town-board/play?sponsor=${sponsor.id}`}>
              Open the game as this school
            </Link>
          </Button>
        </div>
      </header>

      {sponsor.livery && (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] tracking-widest text-ink-3 uppercase">
              Car
            </span>
            {BOARD_CARS.map((c) => (
              <Button
                key={c.id}
                size="sm"
                variant={c.id === car ? "ink" : "paper"}
                onClick={() => setCar(c.id)}
              >
                {c.label}
                {sponsor.livery?.cars[c.id] ? "" : " (no paint)"}
              </Button>
            ))}
          </div>
          <Section
            title="Car paint, flat"
            note="The school's art on this car's wrap template. Turn on the template to see where the bodywork, glass and the safe boxes for lettering fall."
          >
            <label className="mb-2 flex items-center gap-2 text-[14px]">
              <input
                type="checkbox"
                checked={overlay}
                onChange={(e) => setOverlay(e.target.checked)}
              />
              Show the template over it
            </label>
            <div className="relative w-full max-w-4xl rounded-lg border border-line">
              <img
                src={wrapFull}
                alt="The car's paint, flat"
                className="block w-full"
              />
              {overlay && (
                <img
                  src={template}
                  alt=""
                  className="absolute inset-0 h-full w-full opacity-60 mix-blend-multiply"
                />
              )}
            </div>
            <p className="mt-2 text-[13px] text-ink-2">
              Template for the school's designer:{" "}
              <a href={template} download className="underline">
                {car}-template.svg
              </a>{" "}
              (2048 by 2048 pixels).
            </p>
          </Section>

          <Section
            title="Car paint, in 3D"
            note="Drag to turn it. The seat views use the board camera's own tilt: the roof and bonnet are what a learner reads; a side shows only when it faces their seat."
          >
            <div className="mb-3 flex flex-wrap gap-2">
              {VIEWS.map((v) => (
                <Button
                  key={v.label}
                  variant={v.view === view ? "ink" : "paper"}
                  size="sm"
                  onClick={() => setView(v.view)}
                >
                  {v.label}
                </Button>
              ))}
            </div>
            <div className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-[14px]">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={roll}
                  onChange={(e) => setRoll(e.target.checked)}
                />
                Turn the wheels
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={steer}
                  onChange={(e) => setSteer(e.target.checked)}
                />
                Steer left and right
              </label>
            </div>
            <div className="aspect-[4/3] w-full max-w-3xl rounded-lg border border-line sm:aspect-[16/9]">
              {mounted && (
                <React.Suspense fallback={null}>
                  <SponsorCarCanvas
                    car={car}
                    wrapUrl={paint?.hi ?? null}
                    base={sponsor.livery.base}
                    topBoard={sponsor.topBoard ?? null}
                    view={carView}
                    roll={roll}
                    steer={steer}
                  />
                </React.Suspense>
              )}
            </div>
          </Section>
        </>
      )}

      <Section
        title="Brass plate"
        note="Engraved on the frame on every side of the table, so each seat has one on its near edge."
      >
        {mounted && <PlatePreview logo={sponsor.logo.mono} />}
      </Section>

      <Section
        title="Painted on the board"
        note="Pale and faded in the green field by the roundabout, quieter than the road paint. Seen from the south side of the table."
      >
        <div className="grid gap-4 md:grid-cols-[2fr_3fr]">
          <div
            className="rounded-lg border border-line [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
            dangerouslySetInnerHTML={{
              __html: fullBoardSvg({ sponsorLogo: sponsor.logo.mono }),
            }}
          />
          <div
            className="rounded-lg border border-line [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
            dangerouslySetInnerHTML={{
              __html: fullBoardSvg({
                sponsorLogo: sponsor.logo.mono,
                view: NEAR_SPOT,
              }),
            }}
          />
        </div>
      </Section>

      <Section title="On screen">
        <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
          <div className="flex min-h-40 flex-col items-center justify-end gap-3 rounded-md bg-[#101114] p-4">
            <span className="font-mono text-[11px] tracking-widest text-white/60 uppercase">
              Under the loader
            </span>
            <SponsorCredit
              sponsor={sponsor}
              lead="Board by"
              place="loader"
              className="rounded-md border border-white/15 bg-white/10 px-3 py-2 text-white"
            />
          </div>
          <div className="flex flex-col gap-3 rounded-md border border-line p-4">
            <span className="font-mono text-[11px] tracking-widest text-ink-3 uppercase">
              Settings, Your car
            </span>
            <SponsorCredit sponsor={sponsor} lead="Car by" place="credit" />
          </div>
          <SponsorReadyCard sponsor={sponsor} ready />
          <SponsorReadyCard sponsor={sponsor} ready={false} />
        </div>
      </Section>
      <div className={cn("h-10")} />
    </div>
  );
}
