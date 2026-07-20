# Render Deployment

This project can run on Render with Supabase as the external Postgres/PostGIS database.

## Blueprint

The repository includes `render.yaml` with:

- `smart-water-map-api`: Docker web service from `server/Dockerfile`.
- `smart-water-map-client`: static Vite site from `client/dist`.

Create a new Blueprint in Render from the GitHub repository and use the root `render.yaml`.

## Required Values

Render prompts for variables marked `sync: false`.

API service:

```text
DATABASE_URL=postgresql://postgres.kfgdscgcxszqdmqjkkqe:<password>@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?schema=public
DIRECT_URL=postgresql://postgres.kfgdscgcxszqdmqjkkqe:<password>@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?schema=public
CLIENT_ORIGIN=https://smart-water-map-client.onrender.com
```

Client static site:

```text
VITE_API_URL=https://smart-water-map-api.onrender.com/api/v1
VITE_SOCKET_URL=https://smart-water-map-api.onrender.com
```

If Render assigns a different generated hostname, update these values in the service environment settings and redeploy the client.

## Database

Supabase is already prepared when:

```sh
DIRECT_URL='<supabase-session-pooler-url>' npm run verify:supabase --workspace server
DATABASE_URL='<supabase-session-pooler-url>' DIRECT_URL='<supabase-session-pooler-url>' npm run deploy:migrations --workspace server
```

## Limitations On Free Plan

The API service may spin down when idle on Render's free plan. Socket connections reconnect when the service wakes back up, but first requests can be slow.
