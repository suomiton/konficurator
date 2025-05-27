#!/bin/bash

echo "🧪 Testing Konficurator File Persistence"
echo "======================================="

# Check if the application is running
echo "1. Checking if application is running on localhost:8081..."
if curl -s http://localhost:8081 > /dev/null; then
    echo "✅ Application is running"
else
    echo "❌ Application is not running. Please start with: npm run dev"
    exit 1
fi

echo ""
echo "2. Testing localStorage functionality..."
echo "   - Open http://localhost:8081/debug-storage.html"
echo "   - Click 'Test localStorage' to verify basic functionality"
echo "   - Click 'Check Konficurator Storage' to see current storage"

echo ""
echo "3. Manual test steps:"
echo "   a) Open http://localhost:8081"
echo "   b) Load one or more sample files from the samples/ directory"
echo "   c) Refresh the page (F5 or Cmd+R)"
echo "   d) Verify files are still loaded with a blue info message"
echo "   e) Try editing values and saving (may prompt for save location for restored files)"

echo ""
echo "4. Expected behavior:"
echo "   ✅ Files should persist across page refreshes"
echo "   ✅ Content should be preserved exactly"
echo "   ✅ Blue info message should appear showing restored files"
echo "   ✅ Save functionality should work (may prompt for location)"

echo ""
echo "🚀 Ready to test! Open the application and try the steps above."
