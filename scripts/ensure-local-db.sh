#!/usr/bin/env bash
set -euo pipefail

DB_SERVICE="db"
DB_USER="postgres"
DB_NAME="storia_dev"

printf 'Ensuring local Postgres container is ready...\n'
docker compose up -d "$DB_SERVICE" >/dev/null

for _ in {1..30}; do
  if docker compose exec -T "$DB_SERVICE" pg_isready -U "$DB_USER" -d postgres >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

docker compose exec -T "$DB_SERVICE" sh -lc '
set -eu
DB_NAME="$1"
DB_USER="$2"
DB_EXISTS=$(psql -U "$DB_USER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '\''$DB_NAME'\''")
if [ "$DB_EXISTS" != "1" ]; then
  echo "Creating database $DB_NAME..."
  psql -U "$DB_USER" -d postgres -c "CREATE DATABASE \"$DB_NAME\";"
else
  echo "Database $DB_NAME already exists."
fi
' -- "$DB_NAME" "$DB_USER"
