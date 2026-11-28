/**
 * Homepage hero: one thing to do, said two ways.
 *
 *   a first visit   the board's name, a picture of it and one button that
 *                   starts the course. Nothing is asked of anyone.
 *   a learner who   (has finished a level, or is signed in) their own page:
 *   has started     a greeting, the course card with Continue and their
 *                   numbers, then how to keep the progress or what their
 *                   account gives them (`HomeAccount`).
 *
 * Both end with today's drive and free drive. The server and the first
 * render draw the first visit; the page switches once this browser's saved
 * progress and session are read. `#try-now` is where older links to the home
 * page's first step land.
 */
import { Link } from "react-router";

import { CourseCard } from "~/components/board/board-levels";
import { BoardThumb } from "~/components/board/board-thumb";
import { CourseLabel } from "~/components/board/course-label";
import { DailyDriveRow } from "~/components/board/daily-drive-row";
import { FreeDriveRow } from "~/components/board/free-drive-row";
import { useCourseStart } from "~/components/board/use-course-start";
import { Icon } from "~/components/brand/icon";
import { PlayIcon } from "~/components/brand/icons";
import { HomeAccount } from "~/components/home/home-account";
import { Button } from "~/components/ui/button";
import { useSession } from "~/lib/auth/session";
import { whoIs } from "~/lib/auth/who-is";
import { COURSE_LEVELS, unitOf, UNITS } from "~/lib/board/curriculum";
import { freeLabel } from "~/lib/board/free-copy";
import { stagger } from "~/lib/motion";
import { linkPrefetch } from "~/lib/ui/link-prefetch";

const COURSE_UNITS = UNITS.filter((unit) => unit.id !== "mock");

export function HomeHero() {
  const { href, label, detail, done, ready, next } = useCourseStart();
  const session = useSession();
  const signedIn = session.status === "signed-in";
  // Their own page, once the saved progress is read and says they have
  // started, or they are signed in.
  const started = ready && (done > 0 || signedIn);
  const name = signedIn ? whoIs(session.user).firstName : null;
  const unit = next.kind === "mock" ? null : unitOf(next);
  const unitNumber = unit ? COURSE_UNITS.indexOf(unit) + 1 : 0;
  return (
    <section
      id="try-now"
      className="mx-auto w-full max-w-4xl scroll-mt-20 px-5 pt-5 pb-10 sm:px-9"
    >
      {started ? (
        <header className="grid gap-1">
          <p className="m-0 font-sans text-[10.5px] font-semibold tracking-wider text-ink-3 uppercase">
            {unit
              ? `Unit ${unitNumber} of ${COURSE_UNITS.length} · ${unit.title}`
              : "Every level is done"}
          </p>
          <h1 className="m-0 font-display text-[clamp(24px,6vw,40px)] leading-none font-semibold tracking-tighter text-ink">
            {name ? `Welcome back, ${name}` : "Welcome back"}
          </h1>
        </header>
      ) : (
        <header className="grid gap-3">
          <p className="dr-rise m-0 font-sans text-[10.5px] font-semibold tracking-wider text-ink-3 uppercase">
            For your NTSA test · {freeLabel()}, no account needed
          </p>
          <h1
            style={stagger(1)}
            className="dr-rise m-0 font-display text-[clamp(26px,7.6vw,60px)] leading-[0.92] font-semibold tracking-tighter text-ink"
          >
            Model Town Board. <span className="block text-rush">Drive it.</span>
          </h1>
          <p
            style={stagger(2)}
            className="dr-rise m-0 max-w-2xl font-serif text-[clamp(16px,2.2vw,20px)] leading-snug text-ink-2"
          >
            Learn which lane goes where, take the roundabout, find the shortest
            correct route and park. Break a rule and you're told which one.{" "}
            <Link
              prefetch={linkPrefetch()}
              to="/model-town-board"
              className="underline decoration-ink/30 underline-offset-2 hover:decoration-ink"
            >
              What the Model Town Board is, and every level
            </Link>
            .
          </p>
        </header>
      )}

      <div style={stagger(3)} className="dr-rise mt-4 grid gap-4">
        {started ? (
          <CourseCard full />
        ) : (
          <>
            <Link
              prefetch={linkPrefetch()}
              to={href}
              aria-label={`${label}: ${detail}`}
              className="group block overflow-hidden rounded-soft border border-ink/25 outline-none"
            >
              {/* Shallow on a wide screen, so the button stays above the fold. */}
              <BoardThumb
                priority
                className="aspect-[4/3] sm:aspect-[5/2] lg:aspect-[3/1]"
              />
            </Link>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              <Button
                asChild
                variant="rush"
                size="lg"
                className="w-full sm:w-auto sm:min-w-64"
              >
                <Link prefetch={linkPrefetch()} to={href}>
                  <Icon icon={PlayIcon} size={18} />
                  <CourseLabel label={label} ready={ready} started={done > 0} />
                </Link>
              </Button>
              <p className="m-0 min-w-0 flex-1 text-[14px] leading-snug text-ink-2">
                <strong className="block text-ink">{detail}</strong>
                <span className="font-sans text-[11px] font-medium tracking-wider text-ink-3 uppercase">
                  {done} of {COURSE_LEVELS.length} levels done
                </span>
              </p>
            </div>
          </>
        )}
        {started && <HomeAccount levelsDone={done} />}
        {/* One task a day, the same for everyone, and the streak it keeps.
            A quiet row: Continue stays the one button. */}
        <DailyDriveRow surface="home" />
        {/* No task: the whole board to drive, every rule still said. */}
        <FreeDriveRow surface="home" />
      </div>
    </section>
  );
}
