# Development Dockerfile for Konficurator
# For production builds, use Dockerfile.prod instead

FROM node:20-alpine

# Install Python3 for development server and Rust tools
RUN apk add --no-cache python3 curl build-base git

# Install Rust and wasm-pack for WASM development
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"
RUN rustup target add wasm32-unknown-unknown
RUN curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
RUN cargo install wasm-bindgen-cli --force

# Prevent wasm-pack from attempting to download glibc binary on musl Alpine
ENV WASM_PACK_NO_INSTALL=true
ENV WASM_BINDGEN_BIN=/root/.cargo/bin/wasm-bindgen

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY parser-wasm/package*.json ./parser-wasm/
COPY parser-wasm/Cargo.toml ./parser-wasm/

# Create empty Cargo.lock to avoid issues with wasm-pack
RUN touch ./parser-wasm/Cargo.lock

# Install all dependencies (including devDependencies)
RUN npm ci --no-optional

# Copy source code
COPY . .

# Build WASM module for development (skip auto-install)
RUN cd parser-wasm && wasm-pack build --target web --dev

# Build TypeScript for development
RUN npm run build

# Expose development port
EXPOSE 8080

# Start development server
CMD ["npm", "run", "dev"]
