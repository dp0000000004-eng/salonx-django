# Real-time chair-based booking & availability

Rebuild SalonX booking on real salon capacity: chairs, true durations, 10-minute start times, and backend-enforced conflict protection. Existing salons, bookings, services and hairstyles stay intact.

## What the salon owner gets

A new **Booking Settings** page in the owner dashboard:
- Opening and closing time, working days, holiday/closed dates
- Number of chairs (each chair is independent capacity), with names
- Booking start interval (default 10 minutes) and optional buffer after each booking (off unless enabled)
- Blocked time periods
- Reducing chairs is refused with a clear warning when those chairs hold future bookings

Services and hairstyles keep their own price and duration; a new "bookable" switch controls whether customers can book them. Duration set by the owner is the only duration used — customers can never change it.

## What the customer gets

Home → salon card → **Book Now** → salon page for that exact salon only:
- Real cover image (fills the frame) and logo (never stretched), name, address, live Open/Closed
- Service categories, then that salon's services / hairstyles / wedding packages with real price and duration
- Pick a date, then only genuinely bookable start times on the salon's interval — never past times, never a time whose full duration cannot finish before closing or fit on a free chair
- Booking summary showing start, calculated end, duration and price, then Confirm
- Clear messages instead of silence: "No available times for this date", "This time slot is no longer available. Please choose another time.", retry on load failure

Layouts are mobile-first and tested from 320px up through tablet and a centred desktop max-width.

## Technical plan

### Database (migration)
- `salon_resources` (salon_id, name, sort_order, is_active) + per-salon defaults; auto-seed one chair for existing salons so nothing breaks.
- `salon_closures` (salon_id, closed_date, reason) for holidays.
- `salons` booking config columns: `booking_interval_min` (default 10), `buffer_min` (default 0), `timezone` (default 'Asia/Kolkata').
- `services.is_bookable`, `hairstyles.is_bookable`, `wedding_packages.is_bookable` (default true).
- `bookings.resource_id` FK → `salon_resources`; btree_gist exclusion constraint on `(resource_id WITH =, tsrange(start_at, end_at) WITH &&)` filtered to capacity-blocking statuses, so the database itself rejects overlaps.
- Rewrite `salon_available_slots(salon_id, date, duration_min)`: reads hours, working day, closure, blocks, interval, buffer, current time in salon timezone, existing bookings per resource; returns start times where at least one chair is free for the whole duration (+buffer).
- Rewrite `create_booking(...)`: keeps existing login / mobile / rate-limit / restriction / duplicate / upcoming-limit rules, then re-validates everything server-side, picks the first free chair with `SELECT ... FOR UPDATE` on the salon's resources inside the transaction, and inserts with `resource_id`; exclusion violation → "This time slot is no longer available. Please choose another time."
- `salon_open_now(salon_id)` for dynamic Open/Closed from hours + working day + closures.
- Cancelled / completed / expired / no-show bookings excluded from the capacity predicate, so cancelling frees the chair immediately.
- RLS: resources and closures readable publicly for approved salons, writable only by the owning salon or super admin.

### Frontend
- `src/lib/booking.ts` — availability + settings hooks, all salon-scoped.
- New `src/components/owner/OwnerBookingSettings.tsx`, wired into `owner.tsx` nav; chair-reduction guard uses a backend check.
- `src/routes/salons/$slug.tsx` reworked into a stepped, responsive booking flow (category → item → date → time → summary → confirm) using the new engine; cover `object-cover`, logo `object-contain`.
- Realtime subscriptions on `bookings`, `salon_blocks`, `salon_hours`, `salon_closures`, `salon_resources`, `services`, `hairstyles` (filtered by salon) so availability recalculates without refresh, for customer and owner.
- Loading / empty / error+retry states on every data-driven section.

### Verification
Playwright run of the booking flow at 320/375/414px plus desktop, and SQL checks for the chair, buffer, closing-time-boundary, past-time, cancellation and concurrent-booking cases.
