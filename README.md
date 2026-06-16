# Smart Water Map

Production-ready monorepo scaffold for a drought monitoring platform with PostGIS-backed GIS data, real-time sensor events, scheduled drought risk jobs, and a React operations dashboard.

## File Tree

```text
smart-water-map/
  client/
    Dockerfile
    nginx.conf
    src/
      components/
        AlertBanner.jsx
        DroughtMap.jsx
        WaterTableTerrain.jsx
        SensorCard.jsx
        SeverityBadge.jsx
        TimeSeriesChart.jsx
      layouts/AppLayout.jsx
      pages/
        AdminUsersPage.jsx
        AlertsPage.jsx
        DashboardPage.jsx
        DistrictDetailPage.jsx
        ForecastsPage.jsx
        LoginPage.jsx
        MapPage.jsx
        ReportsPage.jsx
        SensorsPage.jsx
      routes/
        ProtectedRoute.jsx
        router.jsx
      i18n/translations.js
      services/
        api.js
        socket.js
      stores/authStore.js
      stores/languageStore.js
      utils/geoHelpers.js
      utils/offlineReports.js
      utils/photoEvidence.js
      main.jsx
      styles.css
    .env.example
    index.html
    package.json
    postcss.config.js
    tailwind.config.js
    vite.config.js
  server/
    Dockerfile
    prisma/
      schema.prisma
      seed.js
    src/
      config/
        env.js
        prisma.js
      jobs/scheduler.js
      middleware/
        auth.js
        errorHandler.js
      routes/
        alerts.js
        auth.js
        community.js
        dashboard.js
        districts.js
        forecasts.js
        index.js
        satellite.js
        sensors.js
      services/
        readingService.js
        socket.js
      utils/
        alertDispatcher.js
        droughtScore.js
      app.js
      index.js
    .env.example
    package.json
  docker-compose.yml
  package.json
  README.md
```

## Stack

- Backend: Node.js, Express, Prisma, PostgreSQL/PostGIS, Socket.io, JWT, node-cron.
- Frontend: React, Vite, Tailwind CSS, React Router v6, Zustand, Leaflet/react-leaflet, Recharts.
- Advanced GIS: drought timelapse, borehole infrastructure, conflict-risk overlays, flood/drought event layers, and Three.js groundwater terrain.
- Field collection: offline-first PWA reporting, compressed photo evidence with GPS tagging, multilingual UI, IVR/WhatsApp intake stubs, and contributor points.
- API versioning: all application routes live under `/api/v1`.

## Setup

### Docker Setup

1. Clone the repository.

```bash
git clone https://github.com/chebiik04-arch/smart-water-map.git
cd smart-water-map
```

2. Build and start the stack.

```bash
docker compose up --build
```

This starts:

- `postgres`: PostgreSQL with PostGIS.
- `migrate`: one-shot Prisma schema sync using `prisma db push`.
- `server`: Express, Socket.io, JWT, cron jobs, and API routes.
- `client`: production Vite build served by Nginx.

3. Seed demo data when needed.

```bash
docker compose --profile seed up seed
```

4. Open the app.

Client: `http://localhost:5174`

API: `http://localhost:4001`

Postgres is exposed on host port `5433` and container port `5432`.

Seeded admin login:

```text
admin@smartwater.local
AdminPass123
```

Useful Docker scripts:

```bash
npm run docker:up
npm run docker:seed
npm run docker:logs
npm run docker:down
```

### Local Node Setup

1. Install dependencies.

```bash
npm install
```

2. Configure environment files.

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

3. Start PostgreSQL with PostGIS.

```bash
docker compose up -d
```

4. Run Prisma migration and seed data.

```bash
npm run prisma:generate
npm run prisma:migrate
npm run seed
```

5. Start the full stack.

```bash
npm run dev
```

Client: `http://localhost:5173`

API: `http://localhost:4000`

## API Routes

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `GET /api/v1/districts`
- `GET /api/v1/districts/:id/status`
- `GET /api/v1/sensors`
- `POST /api/v1/sensors/:id/reading`
- `GET /api/v1/sensors/:id/readings`
- `GET /api/v1/satellite/:districtId`
- `GET /api/v1/alerts`
- `POST /api/v1/alerts/:id/resolve`
- `GET /api/v1/community/reports`
- `POST /api/v1/community/report`
- `POST /api/v1/community/reports/:id/verify`
- `GET /api/v1/community/leaderboard`
- `POST /api/v1/community/voice/ivr`
- `POST /api/v1/community/voice/whatsapp`
- `GET /api/v1/forecasts/:districtId`
- `GET /api/v1/dashboard/summary`
- `GET /api/v1/map-layers/drought-timeline`
- `GET /api/v1/map-layers/boreholes`
- `GET /api/v1/map-layers/conflict-risks`
- `GET /api/v1/map-layers/hydro-events`

## GIS Intelligence Layers

- Animated drought progression: slider-driven weekly drought spread across districts.
- 3D terrain with water table: Three.js terrain card showing groundwater depth as a subsurface layer.
- Borehole network map: borehole depth, yield, district, and status markers.
- Conflict risk overlay: historical water-scarcity conflict risk polygons.
- Flood-drought duality map: flash flood and drought event footprints on the same operational map.

## Field Reporting

- Offline-first mobile app: Vite PWA manifest, service worker app-shell caching, IndexedDB report queue, and manual/automatic sync when connectivity returns.
- Photo evidence: camera capture input, browser-side JPEG compression, GPS coordinates, GPS accuracy, and photo metadata attached to reports.
- Multilingual support: English, Kiswahili, Afaan Oromo, and Somali language selector.
- Voice reporting: IVR and WhatsApp webhook endpoints accept phone-based water level reports for non-smartphone users.
- Gamification: verified reports award contributor points and power the community leaderboard.

## Socket.io Events

Server emits:

- `sensor:update`
- `alert:new`
- `alert:resolved`

Client emits:

- `subscribe:district`

## Scheduled Jobs

- Every 15 minutes: polls active sensors, inserts readings, checks thresholds.
- Every hour: recalculates district drought risk using groundwater, soil moisture, NDVI, and rainfall anomaly.
- Daily at 6:00: dispatches warning and emergency alerts through the Africa's Talking stub.
