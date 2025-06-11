# Development Dockerfile for Konficurator
# For production builds, use Dockerfile.prod instead

FROM node:20-alpine

# Install Python3 for development server and Rust tools
RUN apk add --no-cache python3 curl build-base

# Install Rust and wasm-pack for WASM development
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"
RUN rustup target add wasm32-unknown-unknown
RUN curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
RUN cargo install wasm-bindgen-cli

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies)
RUN npm ci

# Copy source code
COPY . .

# Build WASM module for development
RUN cd parser-wasm && wasm-pack build --target web --dev

# Build TypeScript for development
RUN npm run build

# Expose development port
EXPOSE 8080

# Start development server
CMD ["npm", "run", "dev"]
