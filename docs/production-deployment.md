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
- `database_url`
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

`database_url` should point at the private Postgres endpoint, for example:

```text
postgresql://smart_water:<password>@postgres:5432/smart_water_map?schema=public
```

## Deploy

```sh
cp .env.prod.example .env.prod
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d
```

Postgres is not exposed publicly in the production compose file. Expose the API/client only through a reverse proxy or load balancer with TLS.
