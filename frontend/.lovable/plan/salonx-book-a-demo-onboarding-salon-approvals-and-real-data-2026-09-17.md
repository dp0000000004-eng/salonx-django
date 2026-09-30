# SalonX — Book a Demo onboarding, salon approvals and real data everywhere

## What the audit found

Most of the platform already runs on the real database: salons, services, hairstyles, wedding packages and bookings all carry real IDs, public pages already filter to approved salons, the owner dashboard is scoped to the owner's own salon, and live updates are already wired in several places. So this is a focused upgrade, not a rebuild.

The real gaps are: the public "Register Your Salon" flow, the missing demo-application journey, no approval/suspension workflow for the Super Admin, the Haircut Gallery feature, and a set of salon detail fields that have nowhere to be stored yet.

## 1. Replace "Register Salon" with "Book a Demo"

- New public page at `/book-demo` — "Book a Demo", "Tell us about your salon and we'll help you get started with SalonX."
- Four-step form: salon information, location, business details, salon profile images — plus owner email, password and confirm password (password handled entirely by the existing sign-in system; never stored as text, never visible to the Super Admin).
- Every "Register Salon" button, link, footer entry and call-to-action across the home page, navigation, footer and owner dashboard now points to "Book a Demo".
- The old `/register-salon` address redirects to `/book-demo`.

## 2. One salon record per application

Submitting the form does one safe operation that:
- creates the owner's sign-in account,
- creates or updates their profile,
- creates the salon record with every submitted detail,
- creates the matching demo request,
- links salon and owner together,
- sets it to pending, inactive, not publicly visible.

Confirmation message: "Demo request submitted successfully. Your salon is waiting for approval from SalonX."

Editing a pending application or resubmitting after rejection updates the same salon — it never creates a second one.

## 3. Salon details storage

Add the missing fields to the existing salon table (salon type, WhatsApp number, cover image, salon images, seats, years in business, opening/closing time, weekly closed day, social links, approval/account status, rejection reason, approved/rejected timestamps and actor). Existing columns are reused — no duplicate table.

## 4. Super Admin approvals

New "Salon Approvals" area inside the master dashboard with Pending / Approved / Rejected / Suspended tabs, showing salon, owner, contact, city, area, submitted date and statuses.

- **View details** shows the full application: salon, owner, location, business and account info, with images. Never the password.
- **Approve** (with confirmation) marks it approved, active and live, recording who approved it and when.
- **Reject** requires a reason, records who and when, and notifies the owner in-app.
- **Suspend** takes an approved salon offline: hidden from search and discovery, no new bookings.

## 5. Owner access states

Signing in as an owner whose salon is pending, rejected or suspended shows the matching message instead of the dashboard, with the rejection reason and an "Update Details & Resubmit" option where relevant.

## 6. Remove Haircut Gallery

Removed from the owner sidebar, routes, components and any leftover references. Hairstyles stay exactly as they are — separate feature, untouched.

## 7. Customer experience checks

- Home page sections (search, hairstyles, wedding packages, top-rated salons, verified salons) verified to be fully database-driven with the new wording for empty states: "No salons available yet. Book a demo to get your salon listed on SalonX."
- Salon cards show "New Salon" instead of an invented rating.
- Open/Closed calculated from the salon's real opening time, closing time, weekly closed day and current time, including overnight hours.
- Search and filters extended to cover pincode, rating, open-now and verified salons.
- Live updates so an approved salon appears on the home page, and owner edits to profile, services and status reach customers, without a refresh.

## 8. Security

All visibility and ownership rules are enforced in the database itself: only approved + active + live salons are publicly readable, and an owner can only read or change their own salon's services, packages, bookings and profile. Booking creation re-checks on the server that the salon is approved and active, the service belongs to that salon, and the slot is genuinely free.

## 9. Testing before finishing

Submit a demo application, confirm it stays hidden; approve it and confirm it appears on the home page without a refresh; open the salon and confirm only its own information and services show; add a service as the owner and confirm it appears for customers.

## Technical notes

- Schema changes are additive to `salons` plus new enum values/columns for approval and account status; `demo_requests` is reused for the application queue and linked through `created_salon_id`.
- Onboarding runs through a single server function that creates the auth user with admin privileges, then writes profile, salon and demo request — so no partial records and no duplicates.
- Public visibility is enforced by row-level policies keyed on approval/account status, not by frontend filters.
- Realtime uses the existing `useRealtime` hook with salon-scoped filters and unmount cleanup.
