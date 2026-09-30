# SalonX — React/TypeScript + Django + SQLite

Root intentionally contains both applications so they can be separated later without changing the API contract.

- `frontend/` — React + TypeScript/TanStack UI
- `backend/` — Django REST API + SQLite (`backend/db.sqlite3`)
- `docker-compose.yml` — optional PostgreSQL for deployments that set `DATABASE_ENGINE=postgresql`

## Local development

1. Backend:
   `cd backend`
   `python -m venv .venv`
   Windows: `.venv\\Scripts\\activate`
   `pip install -r requirements.txt`
   `python manage.py migrate`
   `python manage.py seed_salonx`
   `python manage.py runserver 8000`
2. Frontend in a second terminal:
   `cd frontend`
   `npm install`
   `npm run dev`

The backend creates `backend/db.sqlite3` automatically on first migration. The frontend API base defaults to `http://127.0.0.1:8000/api`; override it with `VITE_API_URL` when needed.
Run backend regression tests with `python manage.py test api`.

## Security model

- JWT access/refresh tokens; short-lived access token.
- Django password hashing; never store passwords in frontend/local database.
- CORS allowlist for local frontend only.
- DRF anonymous/user rate limits.
- Server-side role checks; frontend route guards are not security boundaries.
- Booking creation uses a database transaction and row locking before conflict checks.
- Uploads are authenticated and stored under user-specific paths.
- Production must use HTTPS, a strong `DJANGO_SECRET_KEY`, secure cookies where applicable, restricted hosts, and a real object-storage/CDN policy.

## API contract

`GET /health/`

Auth:
- `POST /api/auth/register/`
- `POST /api/auth/login/`
- `POST /api/auth/refresh/`
- `GET /api/auth/me/`

Data compatibility endpoints:
- `GET/POST/PATCH/DELETE /api/db/<resource>/`
- `POST /api/bookings/create/`
- `POST /api/media/upload/`

The frontend no longer imports the Supabase SDK. `frontend/src/lib/api-client.ts` is the single fetch boundary.
