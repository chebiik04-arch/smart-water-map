# Production Deployment

Use `docker-compose.prod.yml` for production. It is intentionally separate from `docker-compose.yml`, which remains local-development oriented.

## Required images

Build and push immutable images before deploying:

```sh
docker build -f server/Dockerfile -t registry.example.com/smart-water-map/server:<commit> .
docker build -f client/Dockerfile \
  --build-arg VITE_API_URL=https://api.example.com/api/v1 \
  --build-arg VITE_SOCKET_URL=https://api.example.com \
  -t registry.example.com/smart-water-map/client:<commit> .
```

## Required Docker secrets

Create these as external Docker secrets, or map them from your platform secret manager:

- `postgres_password`
- `database_pool_url`
- `database_direct_url`
- `jwt_secret`
- `africastalking_api_key`
- `sensor_provider_api_key`
- `whatsapp_provider_token`
- `whatsapp_webhook_secret`
- `twilio_auth_token`
- `africastalking_webhook_token`
- `ivr_provider_token`
- `market_price_api_key`
- `s3_access_key_id`
- `s3_secret_access_key`
- `image_moderation_api_key`
- `operational_alert_webhook_url`

`database_pool_url` should point at PgBouncer for runtime traffic:

```text
postgresql://smart_water:<password>@pgbouncer:6432/smart_water_map?schema=public&pgbouncer=true&connection_limit=1
```

`database_direct_url` should point at the private Postgres endpoint for migrations, backups, and Prisma direct operations:

```text
postgresql://smart_water:<password>@postgres:5432/smart_water_map?schema=public
```

## Deploy

```sh
cp .env.prod.example .env.prod
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d
```

Postgres is not exposed publicly in the production compose file. Expose the API/client only through a reverse proxy or load balancer with TLS.

## Migration Release Procedure

Use the release script for schema changes:

```sh
ENV_FILE=.env.prod SMOKE_BASE_URL=https://api.example.com npm run prod:migration-release
```

The script performs:

1. Compose config validation.
2. A compressed `pg_dump` backup from the direct Postgres service.
3. Prisma migration deploy through the direct database URL.
4. API restart.
5. Smoke tests against `/ready`, `/health`, and `/metrics`.

Backups are written to `./backups` by default and are intentionally ignored by git.

## Rollback Path

If smoke tests fail after migration:

1. Stop application writes or place the API behind maintenance mode.
2. Restore the pre-migration backup printed by the release script:

```sh
docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T postgres \
  pg_restore --clean --if-exists -U smart_water -d smart_water_map \
  < backups/<backup-file>.dump
```

3. Redeploy the last known-good server/client images.
4. Run `/ready`, `/health`, `/metrics`, login, and core sidebar E2E smoke checks.

Never run rollback through PgBouncer. Restores and migrations must use the direct Postgres service or managed database endpoint.

## Connection Pooling

Production compose includes PgBouncer for API runtime traffic. API containers use `database_pool_url`, while migration jobs use `database_direct_url`.

When scaling API replicas, size `PGBOUNCER_DEFAULT_POOL_SIZE` and database `max_connections` together. Keep Prisma runtime URLs pointed at PgBouncer with `pgbouncer=true&connection_limit=1`.
