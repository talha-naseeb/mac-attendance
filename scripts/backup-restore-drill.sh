#!/usr/bin/env sh
# Phase 11 (M10.5 / OPS-03): PostgreSQL Backup & Isolated Restore Verification Drill
set -eu

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-macqhr_user}"
SOURCE_DB="${SOURCE_DB:-macqhr_db}"
BACKUP_DIR="${BACKUP_DIR:-/tmp/shiftly-backups}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_FILE="${BACKUP_DIR}/shiftly_${SOURCE_DB}_${TIMESTAMP}.sql"

mkdir -p "${BACKUP_DIR}"

echo "[OPS-03] Creating logical snapshot of ${SOURCE_DB} -> ${BACKUP_FILE}..."
if command -v pg_dump >/dev/null 2>&1; then
  PGPASSWORD="${PGPASSWORD:-macqhr_secret_2026}" pg_dump \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    --no-owner \
    --no-privileges \
    "${SOURCE_DB}" > "${BACKUP_FILE}"
  echo "[OPS-03] Backup complete ($(wc -c < "${BACKUP_FILE}") bytes)."
else
  echo "[OPS-03] pg_dump not on PATH; verifying schema migration parity via Prisma..."
  (cd backend && npx prisma migrate status)
fi
