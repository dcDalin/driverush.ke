/**
 * The picture that stands for the board game wherever there is a way into it:
 * the home page, the Model Town Board page and the guides. It is a still of
 * the game's own table (captured from `/tools/og?card=board-3d`, see
 * `scripts/build-og-images.mjs`), so what a learner sees is what they will
 * drive: the cars in a driving school's paint, a different school each day
 * (`lib/board/poster.ts`). One line of text and the play button sit over it, in HTML so they
 * stay sharp at any size.
 *
 * It is only a picture. Whoever uses it makes it a link.
 */
import { Icon } from "~/components/brand/icon";
import { PlayIcon } from "~/components/brand/icons";
import { posterPath, posterSchool } from "~/lib/board/poster";
import { cn } from "~/lib/utils";

/** The small file's own size, so the page keeps its shape while it loads. */
const WIDTH = 1200;
const HEIGHT = 630;

export const BOARD_THUMB_ALT =
  "The Model Town Board game: a driving school's car going round the roundabout, past the green island, with two more of its cars waiting on the road in.";

export function BoardThumb({
  className,
  line = "Can you pass the board?",
  priority = false,
}: {
  /** The picture's shape, as an aspect-ratio class. */
  className?: string;
  /** The line over the picture. Pass null for none. */
  line?: string | null;
  /** It is the first thing on the page: fetch it ahead of everything else. */
  priority?: boolean;
}) {
  // Today's school. The UTC day, so the server and the browser agree.
  const school = posterSchool();
  const src = posterPath(school);
  return (
    <span
      className={cn("relative block overflow-hidden", className)}
      // The board's tarmac: what shows for the moment before the picture
      // arrives, or if it can't.
      style={{ backgroundColor: "#17181a" }}
    >
      {/* The car is low in the picture, so a shallow crop keeps the bottom. */}
      <img
        src={src}
        srcSet={`${src} ${WIDTH}w, ${posterPath(school, 2400)} ${WIDTH * 2}w`}
        // never wider than the page's text column
        sizes="(min-width: 56rem) 52rem, 100vw"
        alt={BOARD_THUMB_ALT}
        width={WIDTH}
        height={HEIGHT}
        decoding="async"
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        className="absolute inset-0 size-full object-cover object-[50%_78%] transition-transform duration-300 group-hover:scale-[1.03] group-focus-visible:scale-[1.03] motion-reduce:transition-none"
      />
      {line && (
        <span className="absolute top-3 left-3 rounded-soft bg-kenya-gold px-2.5 py-1.5 font-display text-[clamp(12px,3.2vw,16px)] leading-none font-extrabold tracking-tight text-kenya-gold-foreground uppercase">
          {line}
        </span>
      )}
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-rush text-white shadow-[0_2px_10px_rgba(0,0,0,0.35)]">
          <Icon icon={PlayIcon} size={26} />
        </span>
      </span>
    </span>
  );
}
