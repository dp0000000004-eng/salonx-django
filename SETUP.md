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

### Automatic address completion

The Book a Demo location button can fill the address, area, pincode, state, and district
using device coordinates and a self-hosted Nominatim service. The compose profile uses
Geofabrik's India OpenStreetMap extract (about 1.6 GB at the time of writing) and stores
the imported database in a persistent Docker volume. The first import downloads the
extract and can take a long time and substantial disk, memory, and CPU resources.

Start the service and wait for the initial import to complete:

```powershell
docker compose --profile geocoder up -d nominatim
docker compose logs -f nominatim
```

Set `REVERSE_GEOCODER_URL=http://127.0.0.1:8081/reverse` in the environment of the
Django process. In PowerShell, set it before starting Django:

```powershell
$env:REVERSE_GEOCODER_URL = "http://127.0.0.1:8081/reverse"
cd backend
python manage.py seed_salonx
python manage.py runserver 8000
```

The seed command adds all 36 Indian states and 784 districts from the bundled,
MIT-licensed dataset sourced from the Indian Government's IGOD portal. It is safe to
run repeatedly. If the geocoder is unavailable or a locality is missing from the
map data, coordinates still fill and the user can correct address fields manually.
Only the configured local geocoder receives location coordinates; do not replace its
URL with a third-party service. The location dataset and map extract are separate:
state/district dropdown names come from the bundled administrative list, while reverse
geocoding uses the locally imported OpenStreetMap data.

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
