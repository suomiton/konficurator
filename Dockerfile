FROM node:24-bookworm AS node
FROM rust:1.90-bookworm AS tooling
COPY --from=node /usr/local /usr/local
RUN rustup target add wasm32-unknown-unknown
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

FROM tooling AS development
RUN npm run build:wasm
EXPOSE 8080
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "8080", "--strictPort"]

FROM tooling AS build
RUN npm run build:prod

FROM nginx:alpine AS production
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O - http://localhost:8080/ > /dev/null 2>&1 || exit 1
CMD ["nginx", "-g", "daemon off;"]
