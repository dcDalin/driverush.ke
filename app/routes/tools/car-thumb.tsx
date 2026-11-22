/**
 * `/tools/car-thumb?car=<id>`: one board vehicle alone on a clear background,
 * for `scripts/build-car-thumbs.mjs` to photograph. The pictures go beside the
 * names in the board's car menu (board-settings-sheet), so a learner who does
 * not know the word "wagon" can still pick one.
 *
 * Every vehicle is taken from the same place, so the van and the lorry come
 * out bigger than the six cars, as they are on the board.
 *
 * `&school=<id>` paints it in that school's livery with its roof board, and
 * `&heading=&tilt=&dist=` move the camera: the review sheets of the schools'
 * paint are photographed this way too.
 *
 * Internal: noindex, outside the tools layout so nothing else is in the shot.
 */
import * as React from "react";
import { useSearchParams } from "react-router";

import type { Route } from "./+types/car-thumb";

import { BOARD_CARS, type BoardCarId } from "~/lib/board/cars";
import { CAR_COLORS } from "~/lib/board/full-board";
import { sponsorById } from "~/lib/board/sponsors";

import type { CarView } from "~/components/board/sponsor-car-canvas";

const SponsorCarCanvas = React.lazy(
  () => import("~/components/board/sponsor-car-canvas"),
);

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Car pictures · DriveRush Tools" },
    { name: "robots", content: "noindex,nofollow" },
  ];
}

/** Keep in step with WIDTH and HEIGHT in `scripts/build-car-thumbs.mjs`. */
const WIDTH = 640;
const HEIGHT = 400;

/** From the front and a little to one side, far enough back for the lorry. */
const VIEW: CarView = { heading: 128, tilt: 12, dist: 10 };

export default function CarThumb() {
  const [params] = useSearchParams();
  const wanted = params.get("car");
  const car: BoardCarId =
    BOARD_CARS.find((c) => c.id === wanted)?.id ?? BOARD_CARS[0].id;
  const school = sponsorById(params.get("school"));
  const number = (name: string, fallback: number) => {
    const n = Number(params.get(name));
    return params.has(name) && Number.isFinite(n) ? n : fallback;
  };
  const view: CarView = {
    heading: number("heading", VIEW.heading),
    tilt: number("tilt", VIEW.tilt),
    dist: number("dist", VIEW.dist),
  };

  return (
    <>
      <style>{`html, body { background: transparent !important; margin: 0; }`}</style>
      <div style={{ width: WIDTH, height: HEIGHT }}>
        <React.Suspense fallback={null}>
          <SponsorCarCanvas
            car={car}
            wrapUrl={school?.livery?.cars[car]?.hi ?? null}
            base={school?.livery?.base ?? CAR_COLORS.player}
            topBoard={school?.topBoard ?? null}
            view={view}
            bare
          />
        </React.Suspense>
      </div>
    </>
  );
}
