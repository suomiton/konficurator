#!/bin/bash

# Production Deployment Script for Konficurator
# This script builds an optimized production version ready for deployment

set -e  # Exit on any error

echo "🚀 Starting Konficurator production build..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Run this script from the project root."
    exit 1
fi

# Check if Node.js and npm are available
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed."
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ Error: npm is not installed."
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Run production build
echo "🔨 Running production build..."
npm run build:prod

# Show build statistics
echo "📊 Build completed successfully!"
echo ""
echo "Build artifacts are available in the build/ directory:"
echo "  • Minified and optimized HTML, CSS, and JavaScript"
echo "  • Gzip compressed files (.gz)"
echo "  • Brotli compressed files (.br)"
echo "  • Web server configuration files"
echo ""

# Calculate total compressed size
if command -v du &> /dev/null; then
    original_size=$(du -sb dist/ styles/ index.html 2>/dev/null | awk '{sum += $1} END {print sum}' || echo "0")
    build_size=$(du -sb build/ 2>/dev/null | tail -n1 | awk '{print $1}' || echo "0")
    
    if [ "$original_size" -gt 0 ] && [ "$build_size" -gt 0 ]; then
        reduction=$(echo "scale=1; (1 - $build_size / $original_size) * 100" | bc -l 2>/dev/null || echo "N/A")
        echo "Size reduction: $reduction%"
        echo "Original: $(numfmt --to=iec $original_size 2>/dev/null || echo "$original_size bytes")"
        echo "Optimized: $(numfmt --to=iec $build_size 2>/dev/null || echo "$build_size bytes")"
    fi
fi

echo ""
echo "🎉 Production build ready for deployment!"
echo ""
echo "Next steps:"
echo "  1. Copy the build/ directory to your web server"
echo "  2. Configure your web server using nginx-config.txt or .htaccess"
echo "  3. Test the deployment"
echo ""
echo "For Docker deployment:"
echo "  docker-compose --profile production up konficurator-prod"
