# SalonX — subscriptions, trial, payments and admin control

## Already fixed (live now)
The "Could not load this data" errors on **Salon Approvals** and **Support & Tickets** were real backend faults: salons, tickets, ticket replies and payments had no link to user profiles, so every query asking for the owner/customer name failed. The links (and missing profile records) have been added, and those screens now load real records.

## What this plan builds next

### 1. One plan, one trial
- Retire every existing plan (Basic/Growth/Pro/Enterprise/etc.) — kept in the database as inactive so historical subscriptions stay intact, but hidden everywhere.
- Create a single active plan: **All-in-One Unlimited** (unlimited services, bookings, customers, staff, offers, hairstyles, analytics — no feature tiers).
- 14-day free trial, started by the backend **only** when a Super Admin approves the salon. Trial dates live in the database, so logging out, clearing the browser or switching device cannot reset it.

### 2. Subscription status, enforced server-side
Statuses: `trialing`, `active`, `expired`, `cancelled`, `suspended`.
- Trial/active → everything unlocked.
- Expired → all existing data stays readable; creating or editing bookings, services, offers, hairstyles, customers, staff and reports is blocked.
- Nothing is ever deleted on expiry, and the owner is never logged out.
- Enforcement happens in the database (row rules + a server-side check on every write), not by hiding buttons.

### 3. Owner subscription page
Single card for All-in-One Unlimited with price, billing period, trial status and days remaining, subscription status, start/expiry dates, payment history, and one action button (Subscribe / Renew). No plan comparison.
Expired banner: "Your SalonX subscription has expired. Your existing salon data is safe. Renew your subscription to continue using SalonX's business features." + Renew button.

### 4. Payments — Razorpay and PhonePe only
- Super Admin settings screen: enable/disable each gateway, test/live mode, credentials, connection status. Secrets are stored as server-side secrets, never in the app.
- Checkout is created by the backend; a subscription only becomes active after the backend verifies the payment (webhook + verification call). Duplicate/retried webhooks are handled safely, so a payment can never be counted twice.
- Frontend "payment successful" is never trusted.
- **Needs from you:** Razorpay key id/secret and PhonePe merchant id/salt key (test values are fine to start). I'll ask for them securely when we reach this step.

### 5. Super Admin changes
- Remove the duplicate **Salons** sidebar page; salon management moves into **Salon Approvals** plus an approved-owner management view.
- Approvals: Pending / Approved / Rejected / Suspended, each with the right actions (Approve, Reject with reason, Suspend, Reactivate, Re-approve) and full application details.
- Per-owner control panel: view/edit salon and owner, activate/suspend, and manage their subscription (activate, extend, renew, cancel, suspend, reactivate, extend or end trial), plus their payments, bookings, customers, services, offers and tickets.
- Subscription overview: trial / active / expired / cancelled / suspended counts, expiry dates, revenue and transactions.
- Setting for whether salons with an expired subscription stay publicly visible; when visible, booking is disabled with "This salon is temporarily unavailable for online booking."

### 6. Support tickets
Statuses open / in progress / waiting for owner / resolved / closed, with reply threads, priority and assignment. Owners see only their own tickets; Super Admin sees all — enforced in the database.

### 7. Everywhere
Real database data only, live updates without refresh for approvals, subscriptions, payments, bookings, services, offers, tickets and notifications, and proper loading / empty / error-with-retry states on every screen.

## Technical notes
- New columns on `salon_subscriptions`: `owner_id`, `trial_start_date`, `trial_end_date`, `auto_renew`, `cancelled_at`, `suspended_at`; new `subscription_status_history` and `payment_events` (idempotency) tables; `platform_settings` keys for gateway config and expired-salon visibility.
- `has_active_subscription(salon_id)` SQL function used by RLS write policies on services, offers, hairstyles, bookings, staff and customers; `admin_set_salon_status` extended to start the trial on approval.
- Razorpay/PhonePe order creation, verification and webhooks as TanStack server routes under `src/routes/api/public/*` with signature verification.
- Old plan rows deactivated, not deleted; existing subscriptions migrated onto the new plan.

## Rollout order
1. Database: plan consolidation, trial fields, status history, feature-gate function, RLS write gates.
2. Owner subscription page + expiry gating and banners.
3. Super Admin: sidebar cleanup, owner management, subscription management.
4. Razorpay + PhonePe checkout, verification and webhooks (needs credentials).
5. Support ticket workflow completion and end-to-end testing.
