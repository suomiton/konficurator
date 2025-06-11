#!/bin/bash
# WASM development helper script

set -e

echo "🦀 Building WASM parser module..."

# Check if we're in a Docker container
if [ -f /.dockerenv ]; then
    echo "📦 Running in Docker container"
    cd /app/parser-wasm
else
    echo "🖥️  Running on host machine"
    cd parser-wasm
fi

# Run Rust tests first
echo "🧪 Running Rust tests..."
cargo test

# Build WASM module
echo "🔧 Building WASM module for development..."
wasm-pack build --target web --dev

echo "✅ WASM build complete!"

# If we're in development, also run TypeScript build
if [ "$NODE_ENV" = "development" ]; then
    echo "🔨 Rebuilding TypeScript..."
    cd ..
    npm run build
    echo "✅ TypeScript build complete!"
fi

echo "🎉 All builds complete! The app should reload automatically."
