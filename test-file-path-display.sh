#!/bin/bash
# Test script for file path display functionality
# This script demonstrates both fresh file loads and restored files

echo "🧪 Testing File Path Display Feature"
echo "======================================"

# Check if server is running
echo "📡 Checking if development server is running..."
if ! curl -s http://localhost:8080 > /dev/null; then
    echo "❌ Development server not running. Please run 'npm run serve' first."
    exit 1
fi

echo "✅ Development server is running"

# Check sample files exist
echo "📁 Checking sample files..."
for file in "samples/app-config.json" "samples/app.config" "samples/server-config.xml"; do
    if [ -f "$file" ]; then
        echo "✅ Found: $file"
    else
        echo "❌ Missing: $file"
    fi
done

echo ""
echo "🎯 Test Scenarios to Execute:"
echo "1. Fresh File Load Test:"
echo "   - Open http://localhost:8080"
echo "   - Click 'Select Configuration Files'"
echo "   - Choose sample files"
echo "   - Verify: Files show '📁 Loaded from local file system'"
echo ""
echo "2. Restored Files Test:"
echo "   - Load files (they will be auto-saved to storage)"
echo "   - Refresh the page"
echo "   - Verify: Files show '💾 Restored from browser storage'"
echo ""
echo "3. Mixed Files Test:"
echo "   - Start with restored files"
echo "   - Add new files using file selector"
echo "   - Verify: Mixed indicators displayed correctly"
echo ""

echo "🚀 Opening test pages..."
if command -v open >/dev/null 2>&1; then
    open http://localhost:8080
    sleep 2
    open http://localhost:8080/test-file-path-display.html
elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open http://localhost:8080
    sleep 2
    xdg-open http://localhost:8080/test-file-path-display.html
else
    echo "Please manually open:"
    echo "- http://localhost:8080"
    echo "- http://localhost:8080/test-file-path-display.html"
fi

echo ""
echo "✅ File path display feature is ready for testing!"
echo "📋 Visual requirements to verify:"
echo "   - Path text smaller than filename (0.8rem vs 1.2rem)"
echo "   - Muted gray color (#6c757d)"
echo "   - Positioned directly below filename"
echo "   - Slightly transparent (opacity: 0.85)"
echo "   - Appropriate emoji icons (📁/💾)"
