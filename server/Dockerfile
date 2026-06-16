FROM node:22-alpine AS base
WORKDIR /app

COPY package.json package-lock.json ./
COPY server/package.json server/package.json
RUN npm ci --workspace server --include-workspace-root

COPY server server
RUN npm run prisma:generate --workspace server

WORKDIR /app/server
EXPOSE 4000
CMD ["npm", "run", "start"]

