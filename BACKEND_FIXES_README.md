# SalonX Django/SQLite backend compatibility

## What was fixed

- Configured persistent SQLite as the default database and added committed initial migrations.
- Fixed duplicate model and broken serializer definitions.
- Applied ownership/user scoping and public salon contact-field filtering.
- Implemented foreign-key filters, selected-field projection, nested relations, count/head responses, and offset pagination.
- Added Django API regression tests for the client contract and access control.
- Added `/api/rpc/<name>/` compatibility endpoint for all 22 frontend RPCs.
- Added missing Django models for:
  - `demo_requests`
  - `payment_gateway_settings`
  - `app_features`
  - booking resources/hours/closures/blocks
  - reviews, loyalty transactions, subscription history/subscriptions
- Unknown frontend resources now use a controlled authenticated compatibility table instead of returning `Unknown resource`.
- `pin_code` <-> `pincode` compatibility.
- Common Supabase-style field aliases are translated by `frontend/src/lib/api-client.ts`.
- Added query operators used by the frontend: `gte`, `lte`, `gt`, `lt`, `ilike`, `or`, `not`, `filter`.
- Added access-token refresh/retry in the API client.
- Added real booking slot generation and transactional chair assignment.
- Added owner booking status/reschedule/payment actions.
- Added loyalty rule/redeem actions.
- Added subscription management RPC compatibility.
- Added public `/api/demo/submit/` for Book a Demo onboarding.
- Payment gateway test is intentionally **NOT CONNECTED** until a real provider integration is implemented. It cannot report a fake connected state.

## First run on your PC

From `backend/`:

```bash
python -m pip install -r requirements.txt
python manage.py migrate
python manage.py check
python manage.py test api
python manage.py runserver 127.0.0.1:8000
```

Then from `frontend/`:

```bash
npm install
npm run dev
```

If your frontend uses a different backend port, create/update `.env`:

```env
VITE_API_URL=http://127.0.0.1:8000/api
```

## Optional PostgreSQL

Set `DATABASE_ENGINE=postgresql`, run PostgreSQL, and set these variables:

```env
POSTGRES_DB=salonx
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432
```

## Important test URLs

- `http://127.0.0.1:8000/health/`
- `http://127.0.0.1:8000/api/auth/login/`
- `http://127.0.0.1:8000/api/rpc/salon_available_slots/`
- `http://127.0.0.1:8000/api/demo/submit/`

The RPC and demo endpoints that change data require authentication where appropriate.
