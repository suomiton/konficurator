# Development Dockerfile for Konficurator
# For production builds, use Dockerfile.prod instead

FROM node:20-alpine

# Install Python3 for development server
RUN apk add --no-cache python3

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies)
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript for development
RUN npm run build

# Expose development port
EXPOSE 8080

# Start development server
CMD ["npm", "run", "dev"]
