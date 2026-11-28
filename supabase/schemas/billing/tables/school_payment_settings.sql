-- ===================================================
-- TABLE: public.school_payment_settings
-- ===================================================
-- How a school's learners pay through it: the code the school hands out
-- (HELTZ), the price it sets, and the Paystack subaccount its share settles
-- to. Kept apart from schools because it holds payment details.
--
-- Price (owner, 2026-11-26): no ceiling; at least DriveRush's fixed share
-- plus a small amount for the school (private.school_min_price(), from the
-- school_pass plan). A CHECK cannot read the plan, so the functions hold the
-- minimum and the table only keeps prices positive.
--
-- Bank (owner, 2026-11-26): the owner asks for a bank on the dashboard. The
-- server makes a Paystack subaccount with it and stores it as pending
-- (school_request_bank); DriveRush staff check it with the school and approve
-- it (admin_review_bank), which makes it the live one. Until then the live
-- subaccount, if any, keeps being paid. Staff may also set a bank directly
-- (admin_set_school_payments). Bank details stay in Paystack: here only a
-- label like "Equity ••4321" and the account name.
create table public.school_payment_settings (
  school_id uuid primary key references public.schools (id) on delete cascade,
  code extensions.citext not null unique check (code::text ~ '^[A-Z0-9]{3,12}$'),
  price_kes integer not null default 700 check (price_kes > 0),
  paystack_subaccount_code text check (
    paystack_subaccount_code is null or paystack_subaccount_code ~ '^ACCT_[A-Za-z0-9_]+$'
  ),
  bank_label text check (bank_label is null or char_length(bank_label) between 2 and 80),
  account_name text check (account_name is null or char_length(account_name) between 2 and 120),
  -- A bank the owner asked for, waiting for staff.
  pending_subaccount_code text check (
    pending_subaccount_code is null or pending_subaccount_code ~ '^ACCT_[A-Za-z0-9_]+$'
  ),
  pending_bank_label text check (pending_bank_label is null or char_length(pending_bank_label) between 2 and 80),
  pending_account_name text check (
    pending_account_name is null or char_length(pending_account_name) between 2 and 120
  ),
  requested_by uuid references auth.users (id) on delete set null,
  requested_at timestamptz,
  -- The last review: who, when, and why a bank was turned down.
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  review_note text check (review_note is null or char_length(review_note) between 1 and 300),
  is_active boolean not null default true,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((pending_subaccount_code is null) = (pending_bank_label is null)),
  check ((pending_subaccount_code is null) = (requested_at is null))
);

create index school_payment_settings_updated_by_idx on public.school_payment_settings (updated_by);
create index school_payment_settings_requested_by_idx on public.school_payment_settings (requested_by);
create index school_payment_settings_reviewed_by_idx on public.school_payment_settings (reviewed_by);
create index school_payment_settings_pending_idx
  on public.school_payment_settings (requested_at) where pending_subaccount_code is not null;

comment on table public.school_payment_settings is
  'A school''s pass code, price (no ceiling, at least school_min_price) and Paystack subaccount, with a bank change waiting for staff.';
