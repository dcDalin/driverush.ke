/**
 * Last on the home page, after the board and the signs: the driving schools
 * whose colours the board's cars wear, as one quiet row of linked logos.
 * They sponsor the board (owner, 2026-11-24), so the home page names them.
 */
import { BoardSchools } from "~/components/board/sponsor-credit";

export function HomeSchools() {
  return (
    <section
      aria-labelledby="home-schools"
      className="mx-auto w-full max-w-4xl px-5 pb-16 sm:px-9"
    >
      <h2
        id="home-schools"
        className="m-0 mb-1 font-display text-[clamp(18px,4.4vw,24px)] leading-none font-semibold tracking-tight text-ink"
      >
        The cars on the board
      </h2>
      <p className="m-0 mb-3 text-[14.5px] leading-snug text-ink-2">
        Painted in the colours of Kenyan driving schools. They sponsor the
        board, so it&apos;s free with no ads.
      </p>
      <BoardSchools place="home" onInk={false} />
    </section>
  );
}
