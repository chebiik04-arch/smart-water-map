FROM node:22-alpine AS build
WORKDIR /app

ARG VITE_API_URL=http://localhost:4000/api/v1
ARG VITE_SOCKET_URL=http://localhost:4000
ARG VITE_MAP_TILE_URL=https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL
ENV VITE_MAP_TILE_URL=$VITE_MAP_TILE_URL

COPY package.json package-lock.json ./
COPY client/package.json client/package.json
RUN npm ci --workspace client --include-workspace-root

COPY client client
RUN npm run build --workspace client

FROM nginx:1.27-alpine
COPY client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/client/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

