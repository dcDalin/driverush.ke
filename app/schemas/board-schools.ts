/**
 * The shape of `board_schools()` (and `admin_livery_draft_get()`): the
 * public face of each school, as the database hands it to everyone. Checked
 * on the way in, so a bad row is dropped instead of breaking the board.
 * Media values are school-media paths; `toSponsor()` turns them into URLs.
 */
import { z } from "zod";

const MediaPathSchema = z
  .string()
  .regex(/^[0-9a-f-]{36}\/(logo|livery)\/[0-9a-f]{16}\.(webp|png|jpg)$/);

export const MediaRefSchema = z.object({
  path: MediaPathSchema,
  width: z.number().positive(),
  height: z.number().positive(),
});
export type MediaRef = z.infer<typeof MediaRefSchema>;

const HiLoSchema = z.object({ hi: MediaPathSchema, lo: MediaPathSchema });
const HexSchema = z.string().regex(/^#[0-9a-f]{6}$/);

export const BoardLiverySchema = z.object({
  id: z.uuid(),
  status: z.enum(["draft", "live", "retired"]),
  base_color: HexSchema,
  rail: z.object({ gold: HexSchema, red: HexSchema }),
  paint: z.record(z.string(), HiLoSchema),
  top_board: MediaRefSchema.extend({
    metres: z.object({ width: z.number(), height: z.number() }),
    cut: z.number(),
    edge: HexSchema,
  }).nullable(),
  banner: HiLoSchema.nullable(),
  posters: z
    .object({ logo: MediaPathSchema, lessons: MediaPathSchema })
    .nullable(),
  marks: z.object({ full: MediaPathSchema, mono: MediaPathSchema }),
  thumbs: z.record(z.string(), MediaPathSchema),
  stills: z.object({
    poster: MediaPathSchema.optional(),
    poster_2400: MediaPathSchema.optional(),
    og: MediaPathSchema.optional(),
  }),
});
export type BoardLivery = z.infer<typeof BoardLiverySchema>;

export const BoardBranchSchema = z.object({
  name: z.string(),
  town: z.string().nullable(),
  address: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  phone: z.string().nullable(),
  hours: z
    .record(
      z.string(),
      z.object({ open: z.string(), close: z.string() }).nullable(),
    )
    .nullable(),
});
export type BoardBranch = z.infer<typeof BoardBranchSchema>;

export const BoardProfileSchema = z.object({
  tagline: z.string().nullable(),
  about: z.string().nullable(),
  phone: z.string().nullable(),
  whatsapp: z.string().nullable(),
  email: z.string().nullable(),
  website_url: z.string().nullable(),
  socials: z.record(z.string(), z.string()),
  brand_paint: HexSchema.nullable(),
  brand_ink: HexSchema.nullable(),
  logo: MediaRefSchema.nullable(),
  logo_mono: MediaRefSchema.nullable(),
});
export type BoardProfile = z.infer<typeof BoardProfileSchema>;

export const BoardSchoolSchema = z.object({
  slug: z.string(),
  name: z.string(),
  sponsoring: z.boolean(),
  profile: BoardProfileSchema.nullable(),
  branches: z.array(BoardBranchSchema),
  livery: BoardLiverySchema.nullable(),
});
export type BoardSchool = z.infer<typeof BoardSchoolSchema>;

/** Every valid row; a row that fails the check is left out (and reported). */
export function parseBoardSchools(value: unknown): BoardSchool[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    const parsed = BoardSchoolSchema.safeParse(row);
    if (parsed.success) return [parsed.data];
    console.warn("board_schools: a school was left out", parsed.error.issues);
    return [];
  });
}
