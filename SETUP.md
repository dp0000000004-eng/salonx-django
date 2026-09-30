# SalonX local setup

## 1. Backend (SQLite default)

```text
cd backend
python -m venv .venv
# Windows
.venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_salonx
python manage.py test api
python manage.py runserver 8000
```

Django creates the persistent database at `backend/db.sqlite3` during the first migration.
Backend health: `http://127.0.0.1:8000/health/`

## 2. Frontend

```text
cd frontend
npm install
npm run dev
```

Frontend: `http://localhost:5173` (Vite may use `http://localhost:8080` if that port is occupied).

The frontend reads `VITE_API_URL`, defaulting to `http://127.0.0.1:8000/api`.

To use PostgreSQL instead, set `DATABASE_ENGINE=postgresql` and configure the `POSTGRES_*`
environment variables before starting Django.

## Security rules

- Never put database credentials in frontend `.env`.
- Never put Django secret keys in `VITE_*` variables.
- Never trust frontend role checks; Django permission checks are authoritative.
- Use HTTPS and a strong secret key before production.
- Restrict CORS/ALLOWED_HOSTS in production.
- Keep refresh/access token lifetime short and rotate refresh tokens.
- Validate uploaded files and use private object storage for sensitive media in production.
