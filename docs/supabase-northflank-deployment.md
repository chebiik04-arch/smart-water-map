# Supabase + Northflank Deployment

Use Supabase for PostgreSQL/PostGIS and Northflank for the API and client containers.

## Supabase

1. Create a Supabase project.
2. In `Database > Extensions`, enable `postgis`.
3. Copy two database URLs from `Connect`:
   - `DATABASE_URL`: Supavisor pooler URL for API runtime traffic.
   - `DIRECT_URL`: direct database URL for Prisma migrations.
   - If the direct database host is unreachable because your network is IPv4-only, use the Supavisor session pooler URL for `DIRECT_URL` as well.

For Northflank, prefer these variables:

```text
DATABASE_URL=postgresql://postgres.PROJECT_REF:PASSWORD@aws-REGION.pooler.supabase.com:5432/postgres?schema=public
DIRECT_URL=postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres?schema=public
JWT_SECRET=<long-random-secret>
CLIENT_ORIGIN=<frontend-url>
NODE_ENV=production
PORT=4000
UPLOAD_PROVIDER=local
```

If uploads should use Supabase Storage, configure its S3-compatible endpoint and keep `UPLOAD_PROVIDER=s3`.

## Backend Check

Before deploying migrations, verify the backend can reach Supabase and that PostGIS is enabled. Use the direct URL when reachable, otherwise use the Supavisor session pooler URL:

```sh
cd server
DIRECT_URL='<supabase-direct-url>' npm run verify:supabase
```

## Migrations

Run migrations with `DIRECT_URL`, not the transaction pooler:

```sh
cd server
DATABASE_URL='<supabase-pooler-url>' DIRECT_URL='<supabase-direct-url>' npm run deploy:migrations
```

## Northflank

Deploy only these services:

- API combined service from `/server/Dockerfile`, exposing port `4000`.
- Client combined service from `/client/Dockerfile`, exposing port `80`.

The client build needs:

```text
VITE_API_URL=<api-url>/api/v1
VITE_SOCKET_URL=<api-url>
```

Use Northflank runtime environment variables for the API instead of Docker secret files.
