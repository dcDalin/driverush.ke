-- ===================================================
-- TABLE: public.school_profiles
-- ===================================================
-- What a school says about itself, edited by its owner (or DriveRush staff):
-- the logo, brand colours, contacts, about text and social links. Learners
-- and guests read it through board_schools(), never this table. One row per
-- school, made on its first edit.
create table public.school_profiles (
  school_id uuid primary key references public.schools (id) on delete cascade,
  tagline text check (tagline is null or char_length(tagline) between 2 and 80),
  about text check (about is null or char_length(about) between 2 and 1200),
  phone text check (phone is null or phone ~ '^\+?[0-9 ]{7,20}$'),
  whatsapp text check (whatsapp is null or whatsapp ~ '^\+?[0-9 ]{7,20}$'),
  email extensions.citext check (email is null or email::text ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  website_url text check (website_url is null or website_url ~ '^https://[^\s/?#]+\.[^\s]+$'),
  -- { "facebook" | "instagram" | "tiktok" | "x" | "youtube": "https://..." }
  socials jsonb not null default '{}'::jsonb check (private.valid_socials(socials)),
  brand_paint text check (brand_paint is null or private.valid_hex_colour(brand_paint)),
  brand_ink text check (brand_ink is null or private.valid_hex_colour(brand_ink)),
  -- { path, width, height } in school-media (school_set_logo only).
  logo jsonb check (logo is null or private.valid_media_ref(logo, school_id)),
  logo_mono jsonb check (logo_mono is null or private.valid_media_ref(logo_mono, school_id)),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create index school_profiles_updated_by_idx on public.school_profiles (updated_by);

comment on table public.school_profiles is
  'A school''s own profile: logo, brand colours, contacts, about and socials. Edited by its owner.';
