# Multi-stage Dockerfile for Konficurator
FROM node:18-alpine AS base

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

RUN npm install

# Build TypeScript
RUN npm run build

# Development stage
FROM base AS development
# Install dev dependencies for development
RUN npm ci
EXPOSE 8080
CMD ["npm", "run", "dev"]

# Production stage
FROM node:18-alpine AS production
WORKDIR /app

# Install Python for the HTTP server
RUN apk add --no-cache python3

# Copy built application from base stage
COPY --from=base /app/dist ./dist
COPY --from=base /app/index.html ./
COPY --from=base /app/styles ./styles
COPY --from=base /app/samples ./samples
COPY --from=base /app/package.json ./

# Create a simple script to serve the application
RUN echo '#!/bin/sh\npython3 -m http.server 8080' > start.sh && chmod +x start.sh

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1

CMD ["./start.sh"]
