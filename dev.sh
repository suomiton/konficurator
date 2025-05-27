#!/bin/bash

# Development script for Konficurator
# Usage: ./dev.sh [command]

set -e

case "${1:-help}" in
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
        echo "🚀 Starting development server..."
        npm run serve
        ;;
    "dev")
        echo "🚀 Starting development mode (build + serve)..."
        npm run build
        echo "✅ Build complete! Starting server..."
        npm run serve
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
        open http://localhost:8080 &
        npm run serve
        ;;
    "help"|*)
        echo "🔧 Konficurator Development Script"
        echo ""
        echo "Available commands:"
        echo "  build   - Build TypeScript to JavaScript"
        echo "  watch   - Watch TypeScript files for changes"
        echo "  serve   - Start HTTP server on port 8080"
        echo "  dev     - Build and serve (development mode)"
        echo "  clean   - Clean build artifacts"
        echo "  test    - Build, serve, and open browser"
        echo "  help    - Show this help message"
        echo ""
        echo "Example: ./dev.sh dev"
        ;;
esac
