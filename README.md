# Barangay Connect

Barangay Connect is a Django web platform for a pilot barangay that moves essential barangay services online.

- **Project Development 1 (Standard Features):** Resident registration, case-insensitive email or username sign-in, sign-out, role-specific dashboards (Resident and Admin/Staff), and user profile viewing, editing, and profile photo upload.
- **Project Development 2 (Core Feature – Vertical Slice):** **Online Document & Service Requests** with real-time status tracking, activity history logs, resident CRUD, and Admin/Staff review queue management backed by PostgreSQL/Supabase.

See the [Project Development 2 Completion Report](docs/BarangayConnect-Oliveros-Rov-G7-PD2.pdf) for full architecture notes, branch/PR history, screenshots, and evaluator test accounts.

## Core Feature: Online Document & Service Requests

Residents can request standard barangay documents online without waiting in line at the barangay hall, while barangay officials/staff process incoming applications through a dedicated review queue.

### Supported Document Types
- Barangay Clearance
- Certificate of Indigency
- Certificate of Residency
- Barangay Business Clearance
- First-Time Jobseeker Certificate

### Role-Based Capabilities & Routes

| Role | Route | Capabilities |
|---|---|---|
| Resident | `/dashboard/resident/` | View request summary counts, recent submissions, and quick actions alongside profile details |
| Resident | `/requests/` | View own requests only (BR-05), filter by status, and search by document type, purpose, or reference code (`REQ-YYYY-NNNN`) |
| Resident | `/requests/new/` | Submit a new document request (defaults to `Pending`, BR-01 & BR-03) with validation for required fields, purpose length, 1–5 copies, and no duplicate active `Pending` request of the same type |
| Resident / Staff | `/requests/<id>/` | View full request details, real-time processing stepper (`Pending` → `Approved` → `Completed`, or `Rejected`), staff remarks, and chronological `DocumentRequestLog` timeline |
| Resident | `/requests/<id>/edit/` | Edit own request details while status is still `Pending` |
| Resident | `/requests/<id>/delete/` | Cancel and permanently delete own `Pending` request via confirmation page |
| Admin / Staff | `/dashboard/admin/` | View live pending queue counts, oldest pending requests, and resident account enrollment chart |
| Admin / Staff | `/requests/manage/` | View all residents' requests (BR-04), filter by status or document type, and search by resident name, email, username, purpose, or reference code |
| Admin / Staff | `/requests/<id>/review/` | Update request status following BR-03 transitions (`Pending` → `Approved` / `Rejected` / `Completed`; `Approved` → `Completed` / `Rejected`) with staff remarks (required when rejecting) and automatic audit logging |
| Admin / Staff | `/requests/<id>/remove/` | Permanently remove `Rejected` records via confirmation page while preserving `Approved` and `Completed` records for audit integrity |

### Database Models
- **`documents.DocumentRequest`**: Stores `user` (`ForeignKey` → `accounts.User`), `document_type`, `purpose`, `copies` (DB `CheckConstraint` 1–5), `notes`, `status` (default `'Pending'`), `reviewed_by` (`ForeignKey` → `accounts.User`, nullable), `staff_remarks`, `created_at`, `updated_at`, and `processed_at`, plus a PostgreSQL partial `UniqueConstraint` preventing duplicate `Pending` requests per `(user, document_type)`.
- **`documents.DocumentRequestLog`**: Stores `request` (`ForeignKey` → `DocumentRequest`), `changed_by` (`ForeignKey` → `accounts.User`), `previous_status`, `new_status`, `note`, and `changed_at` for real-time tracking history.

## Local Setup

Use Python 3.12 or newer, Node.js, and a PostgreSQL database (local PostgreSQL or a Supabase PostgreSQL project).

```powershell
python -m venv venv
.\venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
.\venv\Scripts\python.exe -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

Paste the generated secret key into `DJANGO_SECRET_KEY` in `.env` and fill in your PostgreSQL/Supabase connection settings (`POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST`, `POSTGRES_PORT`). For Supabase, set `POSTGRES_SSLMODE=require`. Keep `DJANGO_DEBUG=True` for local HTTP development. Never commit `.env` (it is listed in `.gitignore`).

Build the frontend bundle (self-hosted fonts and interactive scripts):

```powershell
npm.cmd ci
npm.cmd run build
```

Apply database migrations, create an Admin superuser, and start the development server:

```powershell
.\venv\Scripts\python.exe manage.py migrate
.\venv\Scripts\python.exe manage.py createsuperuser
.\venv\Scripts\python.exe manage.py runserver
```

### Using the Application
- Open [Barangay Connect](http://127.0.0.1:8000/) for the public showcase home page.
- Register a Resident account at `/register/` or sign in with email or username (case-insensitive) at `/login/`.
- Residents are routed to `/dashboard/resident/` and can submit/track document requests at `/requests/`.
- Superusers and accounts with **Staff status** enabled in Django administration (`/admin/`) are routed to `/dashboard/admin/` and manage incoming requests at `/requests/manage/`.
- Profiles are available at `/profile/` and editable at `/profile/edit/` (including profile photos up to 5 MB).

## Interactive Frontend

The frontend uses Django templates and plain JavaScript (no React), styled with a forest green, sand beige, and muted terracotta design system (see [docs/design-system.md](docs/design-system.md)). The build bundles Three.js, GSAP, Motion, Alpine.js, Chart.js, Lottie, and locally hosted Manrope and Lora fonts. Forms, navigation, status filters, and document workflows remain fully usable without JavaScript and respect reduced-motion preferences.

## Verification & Tests

Run Django system checks and the full unit/integration test suite (covers `accounts` and `documents` CRUD, validation, business rules, and role-based access control):

```powershell
.\venv\Scripts\python.exe manage.py check
.\venv\Scripts\python.exe manage.py test accounts documents
```

Django creates a separate PostgreSQL test database (`test_<POSTGRES_DB>`).

For end-to-end Playwright browser tests (build the frontend assets first):

```powershell
.\venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\venv\Scripts\python.exe -m playwright install chromium
.\venv\Scripts\python.exe manage.py test browser_tests.accounts_ui browser_tests.documents_ui
```

To use an installed Microsoft Edge instead of downloading Chromium, set `$env:PLAYWRIGHT_CHANNEL = 'msedge'`.

## Deploying to Render

This repository includes a two-stage [Dockerfile](Dockerfile) (Node.js frontend build + Python 3.14 / Gunicorn / WhiteNoise runtime) and a [render.yaml](render.yaml) Blueprint for Render.

1. Push your branch (or merge into `main`) on GitHub.
2. In Render, create a new **Web Service** with **Runtime: Docker** (or create a **Blueprint** using `render.yaml`).
3. Configure Environment Variables in Render:
   - `DJANGO_DEBUG`: `False`
   - `DJANGO_SECRET_KEY`: a fresh random secret key (do not reuse your local `.env` key)
   - `DATABASE_URL`: your staging PostgreSQL connection URL (for **Supabase**, use the IPv4 **Session Pooler** connection string on port `5432`, not the IPv6-only direct host), **or** set `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST`, `POSTGRES_PORT`
   - `POSTGRES_SSLMODE`: `require`
   - `DJANGO_ALLOWED_HOSTS` / `DJANGO_CSRF_TRUSTED_ORIGINS`: optional for Render's default `*.onrender.com` URL (auto-configured from `RENDER_EXTERNAL_HOSTNAME`); set them if you attach a custom domain.
4. Deploy. On startup, the container runs `python manage.py migrate --noinput` and starts Gunicorn on `$PORT`.
5. Create an Admin superuser once against your staging database (Render's free plan does not include an interactive Shell tab, so run `manage.py createsuperuser` from your machine pointed temporarily at the staging `DATABASE_URL`).
