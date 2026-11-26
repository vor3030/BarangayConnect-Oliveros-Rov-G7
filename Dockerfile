# Stage 1: Build the esbuild frontend bundle (self-hosted fonts & JS modules)
FROM node:24-slim AS frontend-builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY frontend ./frontend
RUN npm run build


# Stage 2: Python/Django runtime
FROM python:3.14-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=10000

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
COPY --from=frontend-builder /app/accounts/static/accounts/ui ./accounts/static/accounts/ui

# Collect static assets at build time using a throwaway key (not persisted in ENV)
RUN DJANGO_SECRET_KEY=build-only-placeholder-key \
    DJANGO_DEBUG=False \
    python manage.py collectstatic --noinput

RUN adduser --disabled-password --gecos "" appuser
USER appuser

EXPOSE 10000

CMD ["sh", "-c", "python manage.py migrate --noinput && exec gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-10000} --workers ${WEB_CONCURRENCY:-2} --timeout 120 --access-logfile - --error-logfile -"]
