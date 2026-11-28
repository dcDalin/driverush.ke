/**
 * The learner's hold on the camera, in plain DOM over the table: drag to slide
 * the view, pinch or scroll to zoom, double tap to see the whole table. The
 * camera never turns, so "up" stays away from you whichever side you stand at.
 *
 * It works during a drive too, under the joystick. There a slide or a zoom is
 * a look round the table: the view goes back to the car as soon as the stick
 * is pushed, and still closes in as it moves and backs off as it stops. Only
 * how close it closes in is the learner's to keep (see `endLook`), and the
 * third button gives that back to the drive too.
 *
 * It writes into `board/stage.ts`'s `cam`, which the scene reads every frame,
 * so moving the view never re-renders React.
 */
import * as React from "react";

import { Icon } from "~/components/brand/icon";
import {
  FocusIcon,
  type IconDef,
  MinusIcon,
  PlusIcon,
} from "~/components/brand/icons";
import { Button } from "~/components/ui/button";
import type { Seat } from "~/lib/board/joystick";
import { cam, fitTable, followCar, panBy, zoomBy } from "~/lib/board/stage";
import { cn } from "~/lib/utils";

/** The direction "away from me" on the table, for each seat. */
const AWAY: Record<Seat, { x: number; z: number }> = {
  south: { x: 0, z: -1 },
  west: { x: 1, z: 0 },
  north: { x: 0, z: 1 },
  east: { x: -1, z: 0 },
};
/** The table is seen at a slant, so a drag up the screen covers more of it. */
const SLANT = 0.7;

/**
 * Zoom in, zoom out, and back to the usual view: in a drive the usual view
 * follows the car, off it the whole table. Shared by the buttons beside the
 * table and the game's More menu.
 */
export function zoomActions(driving: boolean): {
  label: string;
  icon: IconDef;
  run: () => void;
}[] {
  return [
    { label: "Zoom in", icon: PlusIcon, run: () => zoomBy(0.7) },
    { label: "Zoom out", icon: MinusIcon, run: () => zoomBy(1.4) },
    driving
      ? { label: "Follow the car", icon: FocusIcon, run: () => followCar() }
      : {
          label: "Show the whole table",
          icon: FocusIcon,
          run: () => fitTable(),
        },
  ];
}

/**
 * Zoom in, zoom out, and back to the usual view. On their own so the drive
 * can stand them in its column of controls, where nothing can land on them.
 */
export function BoardZoomButtons({
  driving = false,
  className,
}: {
  driving?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {zoomActions(driving).map((action) => (
        <Button
          key={action.label}
          variant="game"
          size="icon"
          aria-label={action.label}
          onClick={action.run}
        >
          <Icon icon={action.icon} size={20} />
        </Button>
      ))}
    </div>
  );
}

export function BoardCameraPad({
  seat,
  driving = false,
  buttons = true,
  buttonsClassName,
}: {
  seat: Seat;
  /** The learner is driving: the arrow keys belong to the car. */
  driving?: boolean;
  /** Draw the zoom buttons here. Off when they stand somewhere else. */
  buttons?: boolean;
  /** Where the zoom buttons sit. */
  buttonsClassName?: string;
}) {
  const pad = React.useRef<HTMLDivElement>(null);
  const touches = React.useRef(new Map<number, { x: number; y: number }>());

  /** Slide the view by a drag measured in pixels. */
  const slide = React.useCallback(
    (dx: number, dy: number) => {
      const width = pad.current?.clientWidth || 1;
      const metres = Math.min(cam.span, cam.max) / width;
      const away = AWAY[seat];
      const right = { x: -away.z, z: away.x };
      panBy(
        (-right.x * dx + (away.x * dy) / SLANT) * metres,
        (-right.z * dx + (away.z * dy) / SLANT) * metres,
      );
    },
    [seat],
  );

  const reset = driving ? followCar : fitTable;

  // Keys, for a computer: plus and minus zoom, 0 shows the whole table, and
  // the arrows slide the view (off the clock: in a drive they steer).
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      const step = 60;
      if (e.key === "+" || e.key === "=") zoomBy(0.8);
      else if (e.key === "-" || e.key === "_") zoomBy(1.25);
      else if (e.key === "0") reset();
      else if (driving) return;
      else if (e.key === "ArrowLeft") slide(step, 0);
      else if (e.key === "ArrowRight") slide(-step, 0);
      else if (e.key === "ArrowUp") slide(0, step);
      else if (e.key === "ArrowDown") slide(0, -step);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slide, driving, reset]);

  const spread = () => {
    const [a, b] = [...touches.current.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };

  return (
    <>
      <div
        ref={pad}
        aria-hidden
        className="absolute inset-0 z-10 cursor-grab touch-none select-none active:cursor-grabbing"
        onPointerDown={(e) => {
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            // a pointer that has already gone: nothing to hold
          }
          touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        }}
        onPointerMove={(e) => {
          const prev = touches.current.get(e.pointerId);
          if (!prev) return;
          const before = spread();
          touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          const fingers = touches.current.size;
          if (fingers >= 2) {
            const now = spread();
            if (before > 0 && now > 0) zoomBy(before / now);
          }
          slide((e.clientX - prev.x) / fingers, (e.clientY - prev.y) / fingers);
        }}
        onPointerUp={(e) => touches.current.delete(e.pointerId)}
        onPointerCancel={(e) => touches.current.delete(e.pointerId)}
        onWheel={(e) => zoomBy(Math.exp(e.deltaY * 0.0015))}
        onDoubleClick={() => reset()}
      />
      {buttons && (
        <BoardZoomButtons
          driving={driving}
          className={cn(
            "absolute right-3 z-20 sm:right-6",
            buttonsClassName ?? "top-[36%] -translate-y-1/2",
          )}
        />
      )}
    </>
  );
}
