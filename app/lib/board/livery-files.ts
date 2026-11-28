/**
 * What a livery folder holds (`seed/fixtures/liveries/<slug>/`, written by
 * `npm run build:sponsors`, `build:car-thumbs` and `build:og`), and how its
 * files map onto a `school_liveries` row. One description for the console's
 * folder upload and for the seed, so both expect the same files.
 *
 *   <car>-wrap4-hi.webp / -lo.webp   paint per car (at least one car)
 *   topboard.webp                    roof board
 *   banner-hi.webp / banner-lo.webp  classroom banner
 *   poster-logo.webp, poster-lessons.webp
 *   logo.png, logo-mono.png          the marks drawn on the board
 *   thumbs/<car>.webp                car menu pictures (optional)
 *   stills/poster.jpg, poster-2400.jpg, og.jpg   board stills (optional)
 *   livery.json                      label, colours, roof board size
 */
import { z } from "zod";

import { BOARD_CARS, type BoardCarId } from "./cars";

const HexSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^#[0-9a-f]{6}$/, "A colour like #f4a20c.");

/** livery.json, and the console's form for the same values. */
export const LiveryMetaSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, "Give it a name.")
    .max(80, "At most 80 characters."),
  base: HexSchema,
  rail: z.object({ gold: HexSchema, red: HexSchema }),
  topBoard: z.object({
    width: z.coerce.number().min(0.2).max(3),
    height: z.coerce.number().min(0.1).max(1.5),
    cut: z.coerce.number().min(0).max(0.5),
    edge: HexSchema,
  }),
});
export type LiveryMeta = z.infer<typeof LiveryMetaSchema>;

export const DEFAULT_LIVERY_META: LiveryMeta = {
  label: "",
  base: "#f6f6f3",
  rail: { gold: "#f4a20c", red: "#e3271b" },
  topBoard: { width: 1.35, height: 0.45, cut: 0.04, edge: "#e3271b" },
};

/** A file the row needs, by its place in the row. */
export type LiveryPart = { key: string; name: string; required: boolean };

const STILLS = [
  ["still:poster", "stills/poster.jpg"],
  ["still:poster_2400", "stills/poster-2400.jpg"],
  ["still:og", "stills/og.jpg"],
] as const;

/**
 * The parts found among a folder's file names (relative to the folder),
 * and the required ones that are missing.
 */
export function planLivery(names: readonly string[]) {
  const have = new Set(names);
  const cars = BOARD_CARS.map((c) => c.id).filter(
    (car) =>
      have.has(`${car}-wrap4-hi.webp`) && have.has(`${car}-wrap4-lo.webp`),
  ) as BoardCarId[];
  const required: LiveryPart[] = [
    { key: "top_board", name: "topboard.webp", required: true },
    { key: "banner:hi", name: "banner-hi.webp", required: true },
    { key: "banner:lo", name: "banner-lo.webp", required: true },
    { key: "poster:logo", name: "poster-logo.webp", required: true },
    { key: "poster:lessons", name: "poster-lessons.webp", required: true },
    { key: "marks:full", name: "logo.png", required: true },
    { key: "marks:mono", name: "logo-mono.png", required: true },
  ];
  const paint: LiveryPart[] = cars.flatMap((car) => [
    { key: `paint:${car}:hi`, name: `${car}-wrap4-hi.webp`, required: true },
    { key: `paint:${car}:lo`, name: `${car}-wrap4-lo.webp`, required: true },
  ]);
  const thumbs: LiveryPart[] = BOARD_CARS.map((c) => c.id)
    .filter((car) => have.has(`thumbs/${car}.webp`))
    .map((car) => ({
      key: `thumb:${car}`,
      name: `thumbs/${car}.webp`,
      required: false,
    }));
  const stills: LiveryPart[] = STILLS.filter(([, name]) => have.has(name)).map(
    ([key, name]) => ({ key, name, required: false }),
  );
  const missing = [
    ...(cars.length === 0 ? ["at least one car's wrap4-hi and -lo"] : []),
    ...required.filter((p) => !have.has(p.name)).map((p) => p.name),
  ];
  return {
    cars,
    parts: [
      ...paint,
      ...required.filter((p) => have.has(p.name)),
      ...thumbs,
      ...stills,
    ],
    missing,
    hasMeta: have.has("livery.json"),
    counts: { cars: cars.length, thumbs: thumbs.length, stills: stills.length },
  };
}

/**
 * The `school_liveries` content once every part is stored: `paths` maps a
 * part's key to its school-media path.
 */
export function liveryRow(
  schoolId: string,
  meta: LiveryMeta,
  cars: readonly BoardCarId[],
  paths: Record<string, string>,
  topBoardSize: { width: number; height: number },
) {
  const at = (key: string) => {
    const path = paths[key];
    if (!path) throw new Error(`No stored file for ${key}`);
    return path;
  };
  const prefixed = (prefix: string) =>
    Object.fromEntries(
      Object.entries(paths)
        .filter(([key]) => key.startsWith(prefix))
        .map(([key, path]) => [key.slice(prefix.length), path]),
    );
  return {
    school_id: schoolId,
    label: meta.label,
    base_color: meta.base,
    rail: meta.rail,
    paint: Object.fromEntries(
      cars.map((car) => [
        car,
        { hi: at(`paint:${car}:hi`), lo: at(`paint:${car}:lo`) },
      ]),
    ),
    top_board: {
      path: at("top_board"),
      width: topBoardSize.width,
      height: topBoardSize.height,
      metres: { width: meta.topBoard.width, height: meta.topBoard.height },
      cut: meta.topBoard.cut,
      edge: meta.topBoard.edge,
    },
    banner: { hi: at("banner:hi"), lo: at("banner:lo") },
    posters: { logo: at("poster:logo"), lessons: at("poster:lessons") },
    marks: { full: at("marks:full"), mono: at("marks:mono") },
    thumbs: prefixed("thumb:"),
    stills: prefixed("still:"),
  };
}

export type LiveryRow = ReturnType<typeof liveryRow>;

/** The content type for a stored file, from its extension. */
export function contentTypeOf(name: string): string | null {
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  return null;
}
