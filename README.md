# Smart Water Map

Production-ready monorepo scaffold for a drought monitoring platform with PostGIS-backed GIS data, real-time sensor events, scheduled drought risk jobs, and a React operations dashboard.

## File Tree

```text
smart-water-map/
  client/
    src/
      components/
        AlertBanner.jsx
        DroughtMap.jsx
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
      services/
        api.js
        socket.js
      stores/authStore.js
      utils/geoHelpers.js
      main.jsx
      styles.css
    .env.example
    index.html
    package.json
    postcss.config.js
    tailwind.config.js
    vite.config.js
  server/
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
- API versioning: all application routes live under `/api/v1`.

## Setup

1. Clone and install dependencies.

```bash
git clone https://github.com/chebiik04-arch/smart-water-map.git
cd smart-water-map
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

Seeded admin login:

```text
admin@smartwater.local
AdminPass123
```

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
- `GET /api/v1/forecasts/:districtId`
- `GET /api/v1/dashboard/summary`

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
