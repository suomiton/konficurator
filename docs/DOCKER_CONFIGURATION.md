# Docker Configuration Guide

## Overview

Konficurator now uses separate Dockerfiles for development and production environments, providing cleaner separation of concerns and optimized builds for each use case.

## Docker Files Structure

### 📁 Dockerfile (Development - Default)

- **Purpose**: Standard development environment
- **Base Image**: `node:20-alpine`
- **Features**:
  - Full npm dependencies installed
  - TypeScript compilation
  - Development server with hot reload
  - Port 8080 exposed

### 📁 Dockerfile.dev (Alternative Development)

- **Purpose**: Explicit development configuration
- **Base Image**: `node:20-alpine`
- **Features**: Identical to main Dockerfile
- **Usage**: For explicit development builds

### 📁 Dockerfile.prod (Production)

- **Purpose**: Optimized production builds
- **Base Images**:
  - Build stage: `node:20-alpine`
  - Runtime stage: `nginx:alpine`
- **Features**:
  - Multi-stage build for minimal final image
  - Complete production optimization pipeline
  - Nginx serving with pre-compressed files
  - Health checks enabled
  - 73% size reduction achieved

## Usage

### Development

```bash
# Using default Dockerfile
docker build -t konficurator:dev .
docker run -p 8080:8080 konficurator:dev

# Using explicit dev Dockerfile
docker build -f Dockerfile.dev -t konficurator:dev .
docker run -p 8080:8080 konficurator:dev

# Using docker-compose (recommended)
docker-compose up konficurator
```

### Production

```bash
# Using production Dockerfile
docker build -f Dockerfile.prod -t konficurator:prod .
docker run -p 8080:8080 konficurator:prod

# Using docker-compose (recommended)
docker-compose --profile production up konficurator-prod
```

## Docker Compose Services

### Development Services

#### `konficurator` (Default Development)

- **Dockerfile**: `Dockerfile`
- **Port**: `8080:8080`
- **Volumes**: Source code mounted for live reload
- **Command**: `npm run dev`

#### `konficurator-dev` (Alternative Development)

- **Dockerfile**: `Dockerfile.dev`
- **Port**: `8081:8080`
- **Profile**: `dev`
- **Volumes**: Source code mounted for live reload
- **Command**: `npm run dev`

### Production Service

#### `konficurator-prod` (Production)

- **Dockerfile**: `Dockerfile.prod`
- **Port**: `8080:8080`
- **Profile**: `production`
- **Features**:
  - Nginx serving optimized files
  - Pre-compressed assets (gzip + brotli)
  - Health checks
  - Optimized caching headers

## Performance Optimizations (Production)

### Build Process

1. **Node.js Build Stage**:

   - Install all dependencies (including devDependencies)
   - Run `npm run build:prod` for complete optimization
   - Generate minified HTML, CSS, JavaScript
   - Create gzip and brotli compressed versions
   - Generate nginx configuration

2. **Nginx Runtime Stage**:
   - Copy optimized build artifacts
   - Serve pre-compressed files automatically
   - Apply optimized caching headers
   - Minimal final image size

### Compression Results

- **Total Size Reduction**: 73% (149,972 → 41,190 bytes)
- **JavaScript**: 50-60% reduction via uglification
- **CSS**: 25% reduction via minification
- **HTML**: 26% reduction via optimization
- **Additional Compression**: 40-77% via gzip/brotli

## Best Practices

### Development

- Use volume mounts for live code reload
- Default Dockerfile is sufficient for most development
- Use `konficurator-dev` service for explicit dev builds

### Production

- Always use `Dockerfile.prod` for production deployments
- Leverage multi-stage builds for minimal image size
- Pre-compressed files served automatically by nginx
- Health checks ensure container reliability

### Security

- Updated to Node.js 20 LTS for latest security patches
- Alpine Linux base images for minimal attack surface
- No sensitive data in container layers
- Production images contain only necessary runtime files

## Troubleshooting

### Common Issues

#### Build Failures

```bash
# Clean Docker cache
docker system prune -a

# Rebuild without cache
docker build --no-cache -f Dockerfile.prod -t konficurator:prod .
```

#### Port Conflicts

```bash
# Check running containers
docker ps

# Use different ports
docker run -p 8081:8080 konficurator:prod
```

#### Volume Mount Issues (Development)

```bash
# Ensure proper file permissions
chmod -R 755 src/ styles/ samples/

# Check volume mounts
docker-compose up konficurator
```

## CI/CD Integration

### GitHub Actions

- **Development builds**: Use `Dockerfile`
- **Production builds**: Use `Dockerfile.prod`
- **Testing**: Both images built and tested automatically
- **Deployment**: Production images deployed to registries

### Build Verification

- Container functionality tested
- Compression headers validated
- Performance metrics tracked
- Health check endpoints verified

## Migration from Previous Setup

### What Changed

- **Before**: Single multi-stage Dockerfile with targets
- **After**: Separate Dockerfiles for clear separation
- **Benefits**:
  - Simpler configuration
  - Clearer intent
  - Easier maintenance
  - Better CI/CD integration

### Update Required

If you have existing scripts or CI/CD that reference Docker targets:

```bash
# Old approach
docker build --target production -t konficurator:prod .

# New approach
docker build -f Dockerfile.prod -t konficurator:prod .
```

## Examples

### Quick Development Setup

```bash
git clone https://github.com/suomiton/konficurator.git
cd konficurator
docker-compose up konficurator
# Visit http://localhost:8080
```

### Production Deployment

```bash
git clone https://github.com/suomiton/konficurator.git
cd konficurator
docker-compose --profile production up konficurator-prod
# Visit http://localhost:8080 (optimized production build)
```

### Manual Build and Test

```bash
# Development
docker build -t konficurator:dev .
docker run --rm -p 8080:8080 konficurator:dev

# Production
docker build -f Dockerfile.prod -t konficurator:prod .
docker run --rm -p 8080:8080 konficurator:prod
```

This new Docker structure provides better separation, clearer intent, and easier maintenance while maintaining all the optimization benefits!
