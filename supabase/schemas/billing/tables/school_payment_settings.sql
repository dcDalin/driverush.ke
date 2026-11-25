-- ===================================================
-- TABLE: public.school_payment_settings
-- ===================================================
-- How a school's learners pay through it (owner, 2026-11-25): the code the
-- school hands out (HELTZ), the price it sets (KES 500 to 1,000; DriveRush
-- keeps a fixed share, the plan's limits.driverush_share_kes), and the
-- Paystack subaccount its share settles to. Kept apart from schools because
-- it holds payment details.
--
-- DriveRush staff set it up (admin_set_school_payments, after creating the
-- subaccount with the school's bank details, which never land here: only a
-- label like "Equity ••4321"). The owner sets the price
-- (school_set_pass_price).
create table public.school_payment_settings (
  school_id uuid primary key references public.schools (id) on delete cascade,
  code extensions.citext not null unique check (code::text ~ '^[A-Z0-9]{3,12}$'),
  price_kes integer not null default 700 check (price_kes between 500 and 1000),
  paystack_subaccount_code text check (
    paystack_subaccount_code is null or paystack_subaccount_code ~ '^ACCT_[A-Za-z0-9_]+$'
  ),
  bank_label text check (bank_label is null or char_length(bank_label) between 2 and 80),
  is_active boolean not null default true,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index school_payment_settings_updated_by_idx on public.school_payment_settings (updated_by);

comment on table public.school_payment_settings is
  'A school''s pass code, price (KES 500 to 1,000) and Paystack subaccount. Staff set it up; the owner sets the price.';
