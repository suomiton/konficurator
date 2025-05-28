# Docker Setup for Konficurator

This document explains how to run Konficurator using Docker and docker-compose.

## Quick Start

### Development Mode
Run the application in development mode with hot-reloading:

```bash
docker-compose up konficurator
```

The application will be available at http://localhost:8080

### Production Mode
Run the application in production mode:

```bash
docker-compose --profile production up konficurator-prod
```

## Available Services

### `konficurator` (Development)
- **Purpose**: Development environment with volume mounts for live code changes
- **Port**: 8080
- **Features**:
  - TypeScript compilation with watch mode
  - Source code mounted as volumes for live editing
  - Automatic restart on file changes

### `konficurator-prod` (Production)
- **Purpose**: Optimized production build
- **Port**: 8080
- **Features**:
  - Multi-stage build for smaller image size
  - No development dependencies
  - Health checks included
  - Optimized for deployment

## Commands

### Build and Start
```bash
# Development
docker-compose up --build konficurator

# Production
docker-compose --profile production up --build konficurator-prod
```

### Run in Background
```bash
# Development
docker-compose up -d konficurator

# Production
docker-compose --profile production up -d konficurator-prod
```

### Stop Services
```bash
docker-compose down
```

### View Logs
```bash
# Development
docker-compose logs -f konficurator

# Production
docker-compose logs -f konficurator-prod
```

### Rebuild
```bash
docker-compose build --no-cache
```

## Volumes

The development service mounts the following directories:
- `./src` - TypeScript source files
- `./styles` - CSS styles
- `./samples` - Sample configuration files
- `./index.html` - Main HTML file

This allows for live editing during development while preserving `node_modules` in the container.

## Environment Variables

- `NODE_ENV`: Set to `development` or `production`

## Ports

- **8080**: HTTP server port (configurable in docker-compose.yml)

## Health Checks

The production service includes health checks that verify the HTTP server is responding correctly.

## Troubleshooting

### Permission Issues
If you encounter permission issues with volume mounts:
```bash
sudo chown -R $USER:$USER .
```

### Port Conflicts
If port 8080 is already in use, modify the port mapping in docker-compose.yml:
```yaml
ports:
  - "3000:8080"  # Use port 3000 instead
```

### Build Issues
If the build fails, try rebuilding without cache:
```bash
docker-compose build --no-cache
```
