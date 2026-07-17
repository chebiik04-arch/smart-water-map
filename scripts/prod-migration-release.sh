#!/usr/bin/env sh
set -eu

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.prod}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
SMOKE_BASE_URL="${SMOKE_BASE_URL:-http://127.0.0.1:4001}"
BACKUP_NAME="${BACKUP_NAME:-smart-water-map-$(date -u +%Y%m%dT%H%M%SZ).dump}"

mkdir -p "$BACKUP_DIR"

echo "==> Rendering production compose"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" config >/dev/null

echo "==> Creating database backup: $BACKUP_DIR/$BACKUP_NAME"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T postgres \
  pg_dump -U "${POSTGRES_USER:-smart_water}" -d "${POSTGRES_DB:-smart_water_map}" -Fc \
  > "$BACKUP_DIR/$BACKUP_NAME"

echo "==> Running migrations"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --rm migrate

echo "==> Restarting API"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d server

echo "==> Smoke testing readiness"
curl -fsS "$SMOKE_BASE_URL/ready" >/dev/null
curl -fsS "$SMOKE_BASE_URL/health" >/dev/null
curl -fsS "$SMOKE_BASE_URL/metrics" >/dev/null

echo "==> Migration release completed"
echo "Backup: $BACKUP_DIR/$BACKUP_NAME"
echo "Rollback restore command:"
echo "  docker compose --env-file $ENV_FILE -f $COMPOSE_FILE exec -T postgres pg_restore --clean --if-exists -U \${POSTGRES_USER:-smart_water} -d \${POSTGRES_DB:-smart_water_map} < $BACKUP_DIR/$BACKUP_NAME"
