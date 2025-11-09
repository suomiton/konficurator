#!/bin/bash

# Development script for Konficurator
# Usage: ./dev.sh [command]

set -e

case "${1:-help}" in
    "wasm")
        echo "🦀 Building WASM module..."
        ./dev-tools/build-wasm.sh
        ;;
    "build")
        echo "🔨 Building TypeScript..."
        npm run build
        echo "✅ Build complete!"
        ;;
    "watch")
        echo "👀 Watching TypeScript files for changes..."
        npm run watch
        ;;
    "serve")
        echo "🚀 Starting Vite development server..."
        npm run dev
        ;;
    "dev")
        echo "🚀 Starting development mode with hot reloading..."
        npm run dev
        ;;
    "clean")
        echo "🧹 Cleaning build artifacts..."
        npm run clean
        echo "✅ Clean complete!"
        ;;
    "test")
        echo "🧪 Testing in browser..."
        npm run build
        echo "✅ Build complete! Opening browser..."
        open http://localhost:5173 &
        npm run dev
        ;;
    "help"|*)
        echo "🔧 Konficurator Development Script"
        echo ""
        echo "Available commands:"
        echo "  wasm    - Build WASM module only"
        echo "  build   - Build WASM + TypeScript to JavaScript"
        echo "  watch   - Watch TypeScript files for changes"
        echo "  serve   - Start Vite dev server on port 5173"
        echo "  dev     - Start Vite dev server (alias for serve)"
        echo "  clean   - Clean build artifacts"
        echo "  test    - Build, serve, and open browser"
        echo "  help    - Show this help message"
        echo ""
        echo "Example: ./dev.sh dev"
        ;;
esac
