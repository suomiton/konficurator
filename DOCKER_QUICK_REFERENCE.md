# Docker Quick Reference

## 🚀 Quick Commands

### Development

```bash
# Start development server
docker-compose up konficurator

# Alternative development build
docker-compose --profile dev up konficurator-dev

# Manual development build
docker build -t konficurator:dev .
docker run -p 8080:8080 konficurator:dev
```

### Production

```bash
# Start production server
docker-compose --profile production up konficurator-prod

# Manual production build
docker build -f Dockerfile.prod -t konficurator:prod .
docker run -p 8080:8080 konficurator:prod
```

## 📁 File Structure

- **`Dockerfile`** → Development (default)
- **`Dockerfile.dev`** → Development (explicit)
- **`Dockerfile.prod`** → Production (optimized)
- **`docker-compose.yml`** → Multi-environment orchestration

## 🔄 Common Workflows

### Local Development

1. `git clone <repo>`
2. `cd konficurator`
3. `docker-compose up konficurator`
4. Open http://localhost:8080

### Production Testing

1. `docker-compose --profile production up konficurator-prod`
2. Verify optimization at http://localhost:8080
3. Check compression headers and performance

### Build Testing

```bash
# Test both environments
docker build -t konficurator:dev .
docker build -f Dockerfile.prod -t konficurator:prod .

# Compare image sizes
docker images konficurator
```

## 🎯 Key Features

- **Development**: Hot reload, full dependencies, debugging enabled
- **Production**: 73% size reduction, nginx serving, pre-compressed files
- **Security**: Node.js 20 LTS, Alpine Linux, minimal attack surface
