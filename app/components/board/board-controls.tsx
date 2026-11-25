/**
 * The joystick: one knob, drawn in plain DOM over the table. Push it toward
 * where you want the car to go on the screen, further to go faster, and let go
 * to stop. Up is always away from you, whichever side of the table you stand
 * at. `board/joystick.ts` turns that into steering and pedals, and holds the
 * lane you are in when lane assist is on.
 *
 * The stick floats (nipplejs, "dynamic" mode): a thumb that lands anywhere in
 * the band along the bottom of the screen gets a stick right under it, so it
 * never has to find the middle of a drawn pad. While nobody is touching it,
 * the stick is drawn at rest in the middle of the band, to show where to put
 * a thumb. Above the band, drags and pinches still move the view.
 *
 * It writes straight into `board/runtime.ts`'s `stick` and moves the knob with a
 * transform, so driving never re-renders React. On a computer the arrow keys
 * (and WASD) steer the car itself, as in a game: up to drive on, left and
 * right to turn, down to brake and back up (`keyStick`). They move the resting
 * knob, and holding Shift drives gently, for parking.
 *
 * With `nudge` on (the first drive), a stick nobody has pushed shows how:
 * after a few seconds, or as soon as a tap lands anywhere without a push, the
 * resting knob slides the way the car faces and back, with a ring round it.
 * Most learners who left the first drive had never moved the car.
 */
import * as React from "react";

import "./board-controls.css";

import { keyStick, STICK_DEADZONE } from "~/lib/board/joystick";
import { car, drive, resetInput, stick, view } from "~/lib/board/runtime";
import { cn } from "~/lib/utils";

type Dir = "left" | "right" | "up" | "down";

const KEYS: Record<string, Dir> = {
  ArrowLeft: "left",
  a: "left",
  A: "left",
  ArrowRight: "right",
  d: "right",
  D: "right",
  ArrowUp: "up",
  w: "up",
  W: "up",
  ArrowDown: "down",
  s: "down",
  S: "down",
};

/** How long an unpushed stick waits before it shows how to push it, ms. */
const NUDGE_AFTER = 3000;

/** How far the knob slides when it shows how to push, as a share of its travel. */
const NUDGE_REACH = 0.7;

/** How far the keys push the knob with Shift held: a crawl, about 2 m/s, for a parking bay. */
const GENTLE = 0.4;

/**
 * Across the stick's base, pixels: the same as the one drawn at rest. A full
 * push is the knob at the rim (72 px from where the thumb landed), so what
 * the knob shows is what the car does. Full speed used to come at 48 px, with
 * the knob only two thirds out and its last third doing nothing.
 */
const STICK_SIZE = 144;

type StickPad = ReturnType<typeof import("nipplejs").create>;

export function BoardControls({
  active,
  reverse = false,
  note,
  quietHint = false,
  nudge = false,
  onFirstPush,
}: {
  active: boolean;
  /** Show how to push the stick when it sits unpushed (the first drive). */
  nudge?: boolean;
  /** The stick was pushed for the first time: how long it took, and with what. */
  onFirstPush?: (first: {
    ms: number;
    input: "touch" | "keys";
    nudged: boolean;
  }) => void;
  /** The first-drive tips are saying it, so the line here stays quiet. */
  quietHint?: boolean;
  /** The task has a reverse gear: say when it is coming in, and when it is in. */
  reverse?: boolean;
  /** Guidance for this task, shown once the first-push hint has gone. */
  note?: string;
}) {
  const base = React.useRef<HTMLDivElement>(null);
  const knob = React.useRef<HTMLDivElement>(null);
  const gear = React.useRef<HTMLParagraphElement>(null);
  const zone = React.useRef<HTMLDivElement>(null);
  const live = React.useRef(active);
  live.current = active;
  const dragging = React.useRef(false);
  const gentle = React.useRef(false);
  const held = React.useRef<Record<Dir, boolean>>({
    left: false,
    right: false,
    up: false,
    down: false,
  });
  // Shown until the learner has pushed the knob once.
  const [hint, setHint] = React.useState(true);
  // The resting knob is showing how to push it.
  const [nudging, setNudging] = React.useState(false);
  // Which hand the next `place` comes from, for `onFirstPush`.
  const input = React.useRef<"touch" | "keys">("touch");
  // When the stick came alive, unpushed. Null once it has been pushed.
  const aliveAt = React.useRef<number | null>(null);
  const pushed = React.useRef(false);
  const nudged = React.useRef(false);
  const firstPush = React.useRef(onFirstPush);
  firstPush.current = onFirstPush;

  /** Put the knob at `x`, `y` (each -1 to 1) and tell the car. */
  const place = React.useCallback((x: number, y: number) => {
    const reach = Math.hypot(x, y);
    const k = reach > 1 ? 1 / reach : 1;
    stick.x = x * k;
    stick.y = y * k;
    const b = base.current;
    const el = knob.current;
    if (b && el) {
      const travel = (b.offsetWidth - el.offsetWidth) / 2;
      el.style.transform = `translate(${(stick.x * travel).toFixed(1)}px, ${(stick.y * travel).toFixed(1)}px)`;
    }
    if (reach > STICK_DEADZONE) {
      setHint(false);
      setNudging(false);
      if (!pushed.current && aliveAt.current != null) {
        pushed.current = true;
        firstPush.current?.({
          ms: Math.round(performance.now() - aliveAt.current),
          input: input.current,
          nudged: nudged.current,
        });
      }
    }
  }, []);

  // The first drive: an unpushed stick shows how to push it, after a few
  // seconds, or straight away when a tap lands with no push (on the car, the
  // road, or the stick without dragging it).
  React.useEffect(() => {
    if (!nudge || !active || pushed.current) {
      setNudging(false);
      return;
    }
    // From the latest time it came alive: the opening turn round the car, or
    // a sheet over the table, is not time spent not knowing what to do.
    aliveAt.current = performance.now();
    const show = () => {
      if (pushed.current) return;
      const b = base.current;
      const el = knob.current;
      if (b && el) {
        // The way the car faces on screen: what the up key would push.
        const at = keyStick(
          { up: true, down: false, left: false, right: false },
          car,
          drive.seat,
          1,
        );
        const travel = ((b.offsetWidth - el.offsetWidth) / 2) * NUDGE_REACH;
        el.style.setProperty("--nudge-x", `${(at.x * travel).toFixed(1)}px`);
        el.style.setProperty("--nudge-y", `${(at.y * travel).toFixed(1)}px`);
      }
      nudged.current = true;
      setNudging(true);
    };
    const wait = window.setTimeout(show, NUDGE_AFTER);
    // After the thumb lifts, so a push that is under way is never nudged.
    const tapped = () => window.setTimeout(show, 0);
    window.addEventListener("pointerup", tapped);
    return () => {
      window.clearTimeout(wait);
      window.removeEventListener("pointerup", tapped);
    };
  }, [nudge, active]);

  React.useEffect(() => {
    const keys = held.current;
    const release = () => {
      dragging.current = false;
      gentle.current = false;
      keys.left = keys.right = keys.up = keys.down = false;
      drive.follow = drive.keyExit = false;
      drive.keyChange = 0;
      if (knob.current) knob.current.dataset.held = "false";
      if (base.current) base.current.dataset.held = "false";
      place(0, 0);
      resetInput();
    };
    if (!active) {
      release();
      return;
    }

    // The keys steer the car itself, so while one is held the knob follows
    // the way the car points, every frame.
    let frame = 0;
    // When left or right went down: tapped is a lane change, held a turn.
    let turnFrom = 0;
    const follow = () => {
      frame = 0;
      drive.follow = drive.keyExit = false;
      drive.keyChange = 0;
      if (dragging.current) return;
      const at = keyStick(
        keys,
        car,
        drive.seat,
        gentle.current ? GENTLE : 1,
        (performance.now() - turnFrom) / 1000,
      );
      input.current = "keys";
      place(at.x, at.y);
      drive.follow = at.follow;
      drive.keyExit = at.exit;
      drive.keyChange = at.change;
      if (keys.up || keys.down || keys.left || keys.right) {
        frame = requestAnimationFrame(follow);
      }
    };
    const fromKeys = () => {
      cancelAnimationFrame(frame);
      follow();
    };
    const onKey = (down: boolean) => (e: KeyboardEvent) => {
      if (e.key === "Shift") {
        gentle.current = down;
        fromKeys();
        return;
      }
      if (e.key === " ") {
        // Space lets go of everything.
        e.preventDefault();
        if (down) {
          keys.left = keys.right = keys.up = keys.down = false;
          fromKeys();
        }
        return;
      }
      const dir = KEYS[e.key];
      if (!dir) return;
      e.preventDefault();
      const turning = keys.left || keys.right;
      keys[dir] = down;
      if (!turning && (keys.left || keys.right)) turnFrom = performance.now();
      fromKeys();
    };
    const keyDown = onKey(true);
    const keyUp = onKey(false);
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    // Switching tabs mid-push must not leave the car driving itself.
    window.addEventListener("blur", release);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("blur", release);
      release();
    };
  }, [active, place]);

  // The floating stick. nipplejs reaches for `window` as it loads, so it is
  // loaded here, in the browser, and only on the board.
  React.useEffect(() => {
    const el = zone.current;
    if (!el) return;
    let gone = false;
    let pad: StickPad | undefined;
    const held = (on: boolean) => {
      // the resting stick steps aside while the floating one is out
      if (base.current) base.current.dataset.held = on ? "true" : "false";
    };
    const drop = () => {
      held(false);
      if (!dragging.current) return;
      dragging.current = false;
      place(0, 0);
    };
    void import("nipplejs").then(({ create }) => {
      if (gone) return;
      pad = create({
        zone: el,
        mode: "dynamic",
        size: STICK_SIZE,
        color: { back: "rgba(23, 24, 27, 0.55)", front: "#2b2d33" },
        fadeTime: 120,
        threshold: 0,
      });
      pad.on("start", () => {
        if (!live.current) return;
        dragging.current = true;
        // the thumb takes over from any key held
        drive.follow = drive.keyExit = false;
        drive.keyChange = 0;
        held(true);
      });
      pad.on("move", (e) => {
        if (!dragging.current || !live.current) return;
        // nipplejs counts up as positive; the stick counts down. Its vector
        // is 1 with the knob at the rim.
        input.current = "touch";
        place(e.data.vector.x, -e.data.vector.y);
      });
      pad.on("end", drop);
    });
    return () => {
      gone = true;
      pad?.destroy();
      drop();
    };
  }, [place]);

  // Reverse gear takes a moment of holding back to come in. Say so, so the
  // learner knows the car heard them, and say when it is in.
  React.useEffect(() => {
    const el = gear.current;
    if (!el) return;
    if (!active || !reverse) {
      el.style.opacity = "0";
      return;
    }
    let frame = 0;
    let shown = "";
    const look = () => {
      frame = requestAnimationFrame(look);
      const text = view.reversing
        ? "Reverse"
        : view.backing > 0
          ? "Keep holding to reverse"
          : "";
      if (text === shown) return;
      shown = text;
      if (text) el.textContent = text;
      el.style.opacity = text ? "1" : "0";
    };
    frame = requestAnimationFrame(look);
    return () => cancelAnimationFrame(frame);
  }, [active, reverse]);

  return (
    <div
      data-board-stick
      className={cn(
        "pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-1 pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-opacity duration-200 sm:pb-6",
        active ? "opacity-100" : "opacity-0",
      )}
    >
      {/* One line of guidance, and no box at all once it has been read: the
          road above the joystick is where the car is. */}
      {((hint && !quietHint) || note) && (
        <p
          key={hint ? (nudging ? "nudge" : "hint") : "note"}
          className="dr-rise m-0 max-w-[17rem] rounded-md bg-[#101114]/85 px-3 py-1.5 text-center text-[12.5px] leading-snug font-semibold text-white"
        >
          {hint && !quietHint ? (
            nudging ? (
              <>
                <span className="pointer-fine:hidden">
                  Put your thumb on the knob and push it the way the car faces.
                </span>
                <span className="hidden pointer-fine:inline">
                  Drag the knob the way the car faces, or press the up arrow.
                </span>
              </>
            ) : (
              "Push toward where you want to go. Let go to stop."
            )
          ) : (
            note
          )}
        </p>
      )}
      <p
        ref={gear}
        role="status"
        className="m-0 rounded-md border-2 border-[#17181b] bg-[#f6c416] px-3 py-1 text-center font-mono text-[11px] font-bold tracking-widest text-[#17181b] uppercase opacity-0 transition-opacity duration-150"
      />

      {/* Anywhere in this band, a thumb gets a stick right under it. On a
          phone it is the whole width; on a wide screen, the middle. The band
          sits in a plain block: nipplejs places its stick wrongly when the
          zone's parent is a flex box. */}
      <div className="absolute inset-x-0 bottom-0 h-[15rem]">
        <div
          ref={zone}
          role="application"
          aria-label="Joystick. Put your thumb anywhere along the bottom and push toward where you want the car to go, and let go to stop. On a computer, the up arrow drives on, left and right turn, and down brakes and backs up; W, A, S and D work too. Hold Shift to go slowly."
          className={cn(
            "board-stick-zone relative mx-auto h-full w-full max-w-[28rem] touch-none select-none",
            active && "pointer-events-auto",
          )}
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>
      {/* The stick at rest: where to put a thumb, and the knob the keys move. */}
      <div className="flex size-[12.5rem] items-center justify-center">
        <div
          ref={base}
          data-held="false"
          className="relative flex size-36 items-center justify-center rounded-full border-2 border-white/30 bg-[#17181b]/70 shadow-[0_6px_0_rgba(0,0,0,0.45)] transition-opacity duration-100 data-[held=true]:opacity-0"
        >
          {nudging && <span aria-hidden className="board-stick-ring" />}
          {/* Four ticks: the knob points at the screen, not at the car. */}
          <svg
            viewBox="0 0 100 100"
            aria-hidden
            className="absolute inset-0 size-full text-white/45"
          >
            <path
              d="M50 9l5 7H45zM50 91l5-7H45zM9 50l7-5v10zM91 50l-7-5v10z"
              fill="currentColor"
            />
          </svg>
          <div
            ref={knob}
            data-held="false"
            data-nudge={nudging ? "true" : undefined}
            className="size-16 rounded-full border-2 border-[#f6c416] bg-[#2b2d33] shadow-[0_4px_0_rgba(0,0,0,0.55),inset_0_2px_0_rgba(255,255,255,0.18)] will-change-transform data-[held=false]:transition-transform data-[held=false]:duration-150"
          />
        </div>
      </div>
    </div>
  );
}
