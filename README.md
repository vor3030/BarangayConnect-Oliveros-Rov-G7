# Barangay Connect

Barangay Connect is a Django application for a pilot barangay. Phase 1 implements Resident registration, email or username sign-in, sign-out, role-specific dashboards, and profile editing. Django renders the frontend with templates and stores accounts and sessions in PostgreSQL.

## Local setup

Use Python 3.12 or newer and a PostgreSQL database. Create a database and login role for Barangay Connect, or use the direct connection details from a Supabase PostgreSQL project.

```powershell
python -m venv venv
.\venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
.\venv\Scripts\python.exe -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

Paste the generated value into `DJANGO_SECRET_KEY` in `.env` and fill in the PostgreSQL connection settings. For Supabase use its database password and set `POSTGRES_SSLMODE=require`. Keep `DJANGO_DEBUG=True` for local HTTP development.

```powershell
.\venv\Scripts\python.exe manage.py migrate
.\venv\Scripts\python.exe manage.py createsuperuser
.\venv\Scripts\python.exe manage.py runserver
```

Open [Barangay Connect](http://127.0.0.1:8000/). Register a Resident account at `/register/`. Both roles sign in with their email or username at `/login/`; both identifiers are case-insensitive. The superuser has the Admin role. To assign the Admin dashboard to an existing account, a superuser can enable **Staff status** for that account in Django administration at `/admin/`. Django account management is reserved for superusers.

Profiles are available at `/profile/`. Users can edit their full name, email, and contact number. After an email change, sign in with the new email or the existing username. If an identifier matches different accounts across email and username fields, sign-in rejects it; use the account's other identifier.

## Interactive frontend

Build the browser assets with Node.js and npm before starting Django or running `collectstatic`.

```powershell
npm.cmd ci
npm.cmd run build
```

The frontend uses Django templates and plain JavaScript, with no React. The build bundles Three.js, GSAP (ScrollTrigger and MotionPathPlugin), Alpine.js, Chart.js, and Lottie locally. Navigation icons are from [useAnimations](https://useanimations.com/).

The interactive neighborhood offers Explore and Aerial camera views, pointer-based depth, and a pause control that stops both the WebGL scene and the animated SVG connection path. GSAP adds scroll reveals, vector drawing, and gentle dashboard card tilt. Continuous scene motion stops offscreen or when the tab is hidden. Reduced-motion preferences disable decorative motion; narrow screens and browsers without WebGL retain a static neighborhood illustration. Forms and navigation remain usable without JavaScript.

## Verify

```powershell
.\venv\Scripts\python.exe manage.py check
.\venv\Scripts\python.exe manage.py test
```

Django creates a separate PostgreSQL test database. Run tests with a local development PostgreSQL login that can create databases.

For the Playwright browser tests, build the frontend first, then run:

```powershell
.\venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\venv\Scripts\python.exe -m playwright install chromium
.\venv\Scripts\python.exe manage.py test browser_tests.accounts_ui
```

To use an installed Microsoft Edge instead, set `$env:PLAYWRIGHT_CHANNEL = 'msedge'` and skip the Chromium installation.
