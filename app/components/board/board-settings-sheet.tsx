/**
 * The board's settings: which side of the table you stand at, which car you
 * drive, how sharp the picture is, lane assist and sound. Opened from the gear button while driving.
 */
import * as React from "react";

import {
  BOARD_CARS,
  CAR_THUMB_SIZE,
  CC_BY,
  type BoardCarId,
  type BoardCarSetting,
} from "~/lib/board/cars";
import { fullBoardSvg } from "~/lib/board/full-board";
import type { Seat } from "~/lib/board/joystick";
import { useBoardStore, type BoardQuality } from "~/lib/board-store";
import { useVisitSponsor } from "~/lib/board/sponsor-visit";
import { cn } from "~/lib/utils";

import { Icon } from "~/components/brand/icon";
import { RoadIcon, ShuffleIcon, SoundIcon } from "~/components/brand/icons";
import { SettingSection, ToggleRow } from "~/components/brand/setting-controls";
import { Button } from "~/components/ui/button";
import { SponsorCredit } from "~/components/board/sponsor-credit";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";

const SEAT_LABEL: Record<Seat, string> = {
  north: "Top",
  west: "Left",
  east: "Right",
  south: "Bottom",
};

/** The board, small, as it lies on the table: the bottom side nearest. */
const TABLE = fullBoardSvg({ numbers: false });

/** `thumb`: the vehicle's picture. "Surprise me" has none, and shows an icon. */
const CAR_CHOICES: {
  value: BoardCarSetting;
  label: string;
  thumb: string | null;
}[] = [
  { value: "random", label: "Surprise me", thumb: null },
  ...BOARD_CARS.map((car) => ({
    value: car.id,
    label: car.label,
    thumb: car.thumb,
  })),
];
const CAR_LABEL = Object.fromEntries(
  BOARD_CARS.map((car) => [car.id, car.label]),
) as Record<BoardCarId, string>;

const PICTURE_CHOICES: { value: BoardQuality; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "low", label: "Smooth" },
  { value: "high", label: "Sharp" },
];

const CHOICE =
  "min-h-11 min-w-[5.5rem] border-2 border-ink px-3 py-2 font-display text-[13px] font-extrabold uppercase tracking-wider outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ink";
const CHOICE_ON = "bg-kenya-gold text-kenya-gold-foreground shadow-stamp";
const CHOICE_OFF = "bg-surface text-ink hover:bg-paper-3";

function SeatButton({
  seat,
  current,
  onPick,
  className,
}: {
  seat: Seat;
  current: Seat;
  onPick: (seat: Seat) => void;
  className?: string;
}) {
  const active = seat === current;
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => onPick(seat)}
      className={cn(CHOICE, active ? CHOICE_ON : CHOICE_OFF, className)}
    >
      {SEAT_LABEL[seat]}
    </button>
  );
}

export function BoardSettingsSheet({
  open,
  onOpenChange,
  seat,
  car,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Where the learner stands now, chosen or not. */
  seat: Seat;
  /** The car on the table now, chosen or drawn for this visit. */
  car: BoardCarId;
}) {
  const settings = useBoardStore((s) => s.settings);
  const setSetting = useBoardStore((s) => s.setSetting);
  const pick = (next: Seat) => setSetting({ seat: next });
  const carChoice = settings.car ?? "random";
  const sponsor = useVisitSponsor();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-md p-0">
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
        </SheetHeader>

        <SheetBody className="space-y-4 p-4">
          <SettingSection
            title="Where you stand at the table"
            description={`Now: ${SEAT_LABEL[seat]}`}
          >
            <div className="grid grid-cols-[1fr_auto_1fr] items-center justify-items-center gap-2.5">
              <SeatButton
                seat="north"
                current={seat}
                onPick={pick}
                className="col-start-2"
              />
              <SeatButton
                seat="west"
                current={seat}
                onPick={pick}
                className="col-start-1 row-start-2 justify-self-end"
              />
              <div
                aria-hidden
                className="col-start-2 row-start-2 w-24 border-2 border-ink [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
                dangerouslySetInnerHTML={{ __html: TABLE }}
              />
              <SeatButton
                seat="east"
                current={seat}
                onPick={pick}
                className="col-start-3 row-start-2 justify-self-start"
              />
              <SeatButton
                seat="south"
                current={seat}
                onPick={pick}
                className="col-start-2 row-start-3"
              />
            </div>
            <p className="m-0 text-[12.5px] leading-snug text-ink-2">
              You see the board from that side, like walking round the table. Up
              on the stick is always away from you.
            </p>
          </SettingSection>

          <SettingSection
            title="Your car"
            description={`Now: ${CAR_LABEL[car]}`}
          >
            <div className="grid grid-cols-2 gap-2.5">
              {CAR_CHOICES.map((choice) => (
                <button
                  key={choice.value}
                  type="button"
                  aria-pressed={choice.value === carChoice}
                  onClick={() => setSetting({ car: choice.value })}
                  className={cn(
                    CHOICE,
                    "flex flex-col p-0",
                    choice.value === carChoice ? CHOICE_ON : CHOICE_OFF,
                  )}
                >
                  {/* The picture keeps its own plain ground, chosen or not:
                      the cars are gold, and would be lost on the gold of a
                      chosen button. */}
                  <span
                    aria-hidden
                    className="flex h-[4.75rem] w-full items-end justify-center bg-surface px-2 pt-2 pb-1.5 text-ink"
                  >
                    {choice.thumb ? (
                      <img
                        src={choice.thumb}
                        alt=""
                        width={CAR_THUMB_SIZE.width}
                        height={CAR_THUMB_SIZE.height}
                        loading="lazy"
                        decoding="async"
                        draggable={false}
                        className="h-full w-full object-contain object-bottom"
                      />
                    ) : (
                      <Icon icon={ShuffleIcon} size={34} className="mb-2.5" />
                    )}
                  </span>
                  <span className="w-full px-2 py-1.5">{choice.label}</span>
                </button>
              ))}
            </div>
            <p className="m-0 text-[12.5px] leading-snug text-ink-2">
              The six cars are the same size and drive the same way. The van and
              the lorry are bigger, as they are on the road. Surprise me picks
              one each time you visit.
            </p>
            {open && sponsor?.livery?.cars[car] && (
              <SponsorCredit sponsor={sponsor} lead="Car by" place="credit" />
            )}
            <ModelCredit />
          </SettingSection>

          <SettingSection title="Picture">
            <div className="grid grid-cols-3 gap-2.5">
              {PICTURE_CHOICES.map((choice) => (
                <button
                  key={choice.value}
                  type="button"
                  aria-pressed={choice.value === settings.quality}
                  onClick={() => setSetting({ quality: choice.value })}
                  className={cn(
                    CHOICE,
                    "min-w-0",
                    choice.value === settings.quality ? CHOICE_ON : CHOICE_OFF,
                  )}
                >
                  {choice.label}
                </button>
              ))}
            </div>
            <p className="m-0 text-[12.5px] leading-snug text-ink-2">
              Auto draws the board as sharp as your phone can, and eases off
              only if the drive stutters. Smooth is the lightest picture. Sharp
              starts again from the fullest.
            </p>
          </SettingSection>

          <SettingSection title="Driving">
            <ToggleRow
              label="Lane assist"
              description="Steadies a shaky thumb so the car keeps to its lane, and steers it into a parking bay when you reverse. Push the stick anywhere else and the car goes there."
              icon={RoadIcon}
              checked={settings.assist ?? true}
              onCheckedChange={(assist) => setSetting({ assist })}
            />
            <ToggleRow
              label="Sound"
              icon={SoundIcon}
              checked={settings.sound}
              onCheckedChange={(sound) => setSetting({ sound })}
            />
          </SettingSection>
        </SheetBody>

        <SheetFooter>
          <Button
            variant="rush"
            size="lg"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            Back to the board
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/** Who made the car models, as their licences ask (docs/asset-rights.md). */
function ModelCredit() {
  return (
    <p className="m-0 text-[11.5px] leading-snug text-ink-3">
      Car models from Sketchfab by{" "}
      {BOARD_CARS.map((entry, i) => (
        <React.Fragment key={entry.id}>
          {i > 0 && (i === BOARD_CARS.length - 1 ? " and " : ", ")}
          <a
            href={entry.model.page}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
          >
            {entry.model.by}
          </a>
        </React.Fragment>
      ))}
      , changed for the board. Shared under{" "}
      <a
        href={CC_BY}
        target="_blank"
        rel="noreferrer"
        className="underline underline-offset-2"
      >
        CC BY 4.0
      </a>{" "}
      or Sketchfab's free licence.
    </p>
  );
}
