-- ===================================================
-- TABLE: public.school_liveries
-- ===================================================
-- A school's look on the board, made by DriveRush with the art pipeline
-- (scripts/sponsor-art, `npm run livery:publish`): car wraps per car model,
-- roof board, classroom banner and posters, the traced marks for the brass
-- plates, car menu thumbnails and the site's board stills. Every value is a
-- path in the school-media bucket. A draft is staff-only; at most one is
-- live per school; board_schools() hands the live one to the app.
create table public.school_liveries (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  status public.livery_status not null default 'draft',
  label text not null check (char_length(label) between 1 and 80),
  -- Body colour where no wrap is drawn, and the classroom's stripe rail.
  base_color text not null check (private.valid_hex_colour(base_color)),
  rail jsonb not null check (
    jsonb_typeof(rail) = 'object'
    and private.valid_hex_colour(rail ->> 'gold')
    and private.valid_hex_colour(rail ->> 'red')
  ),
  -- { "<car>": { "hi": path, "lo": path } }
  paint jsonb not null check (private.valid_paint(paint, school_id)),
  -- { path, width, height } of the picture, plus the board's size in metres,
  -- its corner cut and edge colour.
  top_board jsonb check (
    top_board is null or (
      private.valid_media_ref(top_board, school_id)
      and jsonb_typeof(top_board -> 'metres') = 'object'
      and (top_board #>> '{metres,width}')::numeric between 0.2 and 3
      and (top_board #>> '{metres,height}')::numeric between 0.1 and 1.5
      and (top_board ->> 'cut')::numeric between 0 and 0.5
      and private.valid_hex_colour(top_board ->> 'edge')
    )
  ),
  banner jsonb check (banner is null or (private.valid_media_paths(banner, school_id) and banner ? 'hi' and banner ? 'lo')),
  posters jsonb check (posters is null or private.valid_media_paths(posters, school_id)),
  -- The marks drawn on the board: { "full": path, "mono": path }.
  marks jsonb not null check (private.valid_media_paths(marks, school_id) and marks ? 'full' and marks ? 'mono'),
  thumbs jsonb not null default '{}'::jsonb check (thumbs = '{}'::jsonb or private.valid_media_paths(thumbs, school_id)),
  stills jsonb not null default '{}'::jsonb check (stills = '{}'::jsonb or private.valid_media_paths(stills, school_id)),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  check ((status = 'draft') = (published_at is null))
);

create unique index school_liveries_one_live_idx
  on public.school_liveries (school_id) where status = 'live';
create index school_liveries_school_idx on public.school_liveries (school_id, created_at desc);
create index school_liveries_created_by_idx on public.school_liveries (created_by);

comment on table public.school_liveries is
  'A school''s board livery (car wraps, roof board, banner, posters, marks, thumbs, stills) as school-media paths. Staff only.';
