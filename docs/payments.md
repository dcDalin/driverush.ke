# Payments, banks and the school journey

How money moves on DriveRush, who sets what, and how to set it up for real.
The database side is `supabase/schemas/billing/` (see `docs/database-access.md`);
the Paystack calls are `app/lib/payments/`.

## The money (owner, 2026-11-25 and 2026-11-26)

- **Learners pay; schools pay nothing.** A pass is 60 days of the full course.
- **On their own:** KES 1,000, all to DriveRush.
- **Through a school** (its code, `driverush.ke/pass?code=HELTZ`): the school's
  own price. There is no ceiling. The floor is DriveRush's share plus a little
  for the school: `private.school_min_price()`, from the `school_pass` plan
  (`driverush_share_kes` 300 + `min_school_share_kes` 50 = KES 350). Change
  either in `supabase/migrations/*_reference_plans.sql`.
- **The split happens at Paystack.** Each school pass carries the school's
  subaccount and DriveRush's flat KES 300 (`transaction_charge`), with
  `bearer: "subaccount"`. Paystack's fee comes out of the school's share, so
  DriveRush always receives its whole KES 300. Paystack settles the school's
  share to its bank itself; DriveRush never holds a school's money.
- **30 more days:** KES 300, all to DriveRush, for a learner who has had a pass.

The amounts are fixed in the database when a checkout starts
(`start_pass_checkout`), never by the browser, and a later price change never
alters a payment. A price set before the floor went up is refused at checkout
until the school sets a new one.

## A school's bank

1. **The owner sends it.** Dashboard, Passes tab, "Your bank": bank, account
   number, account name.
   - The server checks the owner, makes a Paystack subaccount and records it
     as **waiting** (`school_request_bank`, service role only).
   - Only "Equity ••4321" and the account name are stored here; the details
     stay with Paystack.
   - DriveRush is emailed (`STAFF_ALERT_EMAIL`), and the console shows
     "1 bank waiting for a check".
2. **Staff check it.** Paystack cannot check a Kenyan account number, so call
   the school and compare it with their bank letter. Then, on the school's
   console page, Payments tab:
   - **Approve:** it goes live and the old subaccount is switched off on
     Paystack. The owner is emailed.
   - **Turn it down, with a reason:** it is switched off. The owner reads the
     reason on their dashboard and by email.
3. **While a change waits,** the live bank keeps being paid.
4. **Staff can also set a bank they have already checked** ("Set the bank
   yourself"). It goes live at once.

A school is not taking payments until it has a live bank. Its set-up
checklist in the console says so.

## Emails (`app/lib/email/`)

| Who gets it                     | When                                   |
| ------------------------------- | -------------------------------------- |
| the owner                       | handed a school, or made its new owner |
| an admin                        | added (or invited) to branches         |
| a student                       | added by a school (and "Email again")  |
| the owner                       | their bank approved or turned down     |
| DriveRush (`STAFF_ALERT_EMAIL`) | an owner sent a bank                   |

How they are sent:

- **`RESEND_API_KEY`:** Resend, from `EMAIL_FROM`, which must be on a domain
  verified in Resend.
- **No key, `MAILPIT_URL` set:** the local Mailpit (http://127.0.0.1:54724),
  next to the sign-in codes.
- **Neither:** nothing is sent; the server logs one line.

A failed email never undoes the change: the person also finds everything in
the app.

## Live dashboards (realtime)

The school dashboard and the console update themselves
(`app/lib/realtime/use-live-revalidate.ts`).

- **Topics.** Triggers broadcast on private topics `school:<id>` and
  `console` (`supabase/schemas/realtime/school_broadcasts.sql`) when a payment
  settles, a student or admin changes, or a bank or price changes.
- **No data in the message.** It says only which table changed. The page
  re-runs its loaders, so row level security decides what it sees.
- **Who may listen.** The policy on `realtime.messages`: a school's owner and
  admins on their school, staff on everything.
- **Fallback.** A slow poll while the tab is visible.
- **Hosted:** Realtime settings, "Allow public access" off (private channels
  only).

## Setting it up for real

1. **Paystack (Kenya).**
   - Live keys in Vercel Production: `PAYSTACK_SECRET_KEY` (`sk_live_…`) and
     `PAYSTACK_WEBHOOK_SECRET` (`whsec_…`). Test keys (`sk_test_…`) in
     Preview.
   - Webhook URL: `https://driverush.ke/api/webhooks/paystack`.
   - Channels: M-PESA and card.
2. **Resend.**
   - Verify the sending domain (driverush.ke).
   - Set `RESEND_API_KEY`, `EMAIL_FROM` and `STAFF_ALERT_EMAIL` in Vercel.
3. **Launch switch.** `VITE_PASSES=on` locks past level 16 and sends learners
   to `/pass`.
   - Until then, `/pass` says passes are not on sale, and school dashboards
     say the code starts working on launch day (no share buttons).
4. **A test-mode rehearsal before going live.** Paystack has never been
   called for real by these tests (they stub it).
   - With `sk_test_` keys, a tunnel to the dev server for the webhook, and a
     Paystack test bank account:
     - an owner sends a bank;
     - staff approve it;
     - a learner pays through the code with a Paystack test card or test
       M-PESA number.
   - Then check that the payment settles once, the pass opens, the earnings
     show the school's share, and Paystack's dashboard shows the split.
5. **For each school:** the owner sends the bank and staff approve it, or
   staff set a checked bank themselves.

## Locally

- `npm run db:seed` gives every demo school a made-up live bank
  (`ACCT_demo_…`; Paystack is never called for these).
- Petanns also has a new bank waiting, so the review shows in the console.
- The `dev-passes` launch config runs with passes on and a placeholder
  Paystack key: pages work, Paystack calls fail.
- Use real test keys to try checkout.
