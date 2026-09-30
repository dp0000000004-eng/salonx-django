# Complete SalonX live operations

## Goal
Finish the production-data transition without changing SalonX’s established visual identity. Empty databases show purposeful empty states; no salon, booking, price, review, staff, or revenue figures are fabricated.

## Build
1. **Stabilize the current live customer experience**
   - Resolve compile, runtime, route, and query errors introduced during the live-data conversion.
   - Remove the remaining hardcoded business records while preserving decorative brand imagery.

2. **Protect operational areas**
   - Move owner and super-admin experiences behind the existing authenticated route gate.
   - Enforce role checks in the UI and on every private read or write.
   - Preserve reliable sign-out and redirect behavior.

3. **Make the owner dashboard operational**
   - Load the signed-in owner’s salon, appointments, customers, reviews, services, staff, hours, gallery, packages, offers, and notifications from Lovable Cloud.
   - Add practical management views and create/edit/status actions for these records.
   - Derive appointment, revenue, customer, rating, and service metrics only from real rows.
   - Subscribe to relevant changes so dashboard and customer pages update automatically.

4. **Make the super-admin dashboard operational**
   - Load real platform totals, recent bookings, salon registrations, locations, ratings, and revenue.
   - Add pending salon review with approve/reject/suspend controls and verification state.
   - Add management for platform service categories and hairstyle catalog entries.
   - Record administrative status changes through existing audit/history mechanisms where available.

5. **Verification**
   - Check empty, signed-out, customer, owner, and admin states.
   - Verify booking conflicts and live updates through the actual interface.
   - Validate mobile, tablet, and desktop layouts.
   - Finish with a clean preview build, focused tests, and no runtime errors.

## Technical details
- Keep customer-facing public reads under narrow public policies; use authenticated server functions for owner/admin data and mutations.
- Keep owner/admin pages under the integration-managed authenticated layout; do not duplicate `/`.
- Reuse React Query keys and database subscriptions already established.
- Use the existing semantic design tokens and SalonX shells; no replacement redesign.
- Payments and the AI hairstyle assistant remain separate milestones because each requires its own integration workflow.
