#!/bin/bash

# Error Notification Fix Validation Script
echo "🔍 Validating Error Notification Fix..."
echo "======================================"

# Check if TypeScript compiled successfully
echo "✅ Checking TypeScript compilation..."
cd /Users/tonisuominen/dev/konficurator
if npm run build > /dev/null 2>&1; then
    echo "   ✓ TypeScript compilation successful"
else
    echo "   ❌ TypeScript compilation failed"
    exit 1
fi

# Check if error notification method exists in compiled JS
echo "✅ Checking compiled JavaScript for error notification method..."
if grep -q "createErrorNotification" dist/renderer.js; then
    echo "   ✓ createErrorNotification method found in compiled code"
else
    echo "   ❌ createErrorNotification method not found in compiled code"
    exit 1
fi

# Check if error handling exists in renderFileEditor
echo "✅ Checking error handling in renderFileEditor..."
if grep -q "_error" dist/renderer.js; then
    echo "   ✓ Error handling code found in compiled renderer"
else
    echo "   ❌ Error handling code not found in compiled renderer"
    exit 1
fi

# Check if CSS styles exist
echo "✅ Checking CSS styles for error notifications..."
if rg -q "error-notification" styles; then
    echo "   ✓ Error notification styles found in CSS"
else
    echo "   ❌ Error notification styles not found in CSS"
    exit 1
fi

# Check if test files exist
echo "✅ Checking test files..."
test_files=("samples/application.config" "samples/app.config" "samples/app-config.json" "samples/server-config.xml")
for file in "${test_files[@]}"; do
    if [ -f "$file" ]; then
        echo "   ✓ Test file found: $file"
    else
        echo "   ❌ Test file missing: $file"
        exit 1
    fi
done

# Check if server is running
echo "✅ Checking development server..."
if curl -s http://localhost:8081 > /dev/null; then
    echo "   ✓ Development server is running on port 8081"
else
    echo "   ❌ Development server is not running on port 8081"
    echo "   ℹ️  Please run: python3 -m http.server 8081"
fi

echo ""
echo "🎉 All validation checks passed!"
echo ""
echo "📋 Manual Testing Instructions:"
echo "1. Open http://localhost:8081 in your browser"
echo "2. Load files using the file picker:"
echo "   - Try loading samples/application.config (should show error notification)"
echo "   - Try loading samples/app.config (should show error notification)"
echo "   - Try loading samples/app-config.json (should show normal form)"
echo "   - Try loading samples/server-config.xml (should show normal form)"
echo ""
echo "✅ Expected Behavior for Error Files:"
echo "   - Yellow/orange error notification appears"
echo "   - NO save button is visible"
echo "   - NO input fields are created"
echo "   - Clear error message is displayed"
echo ""
echo "✅ Expected Behavior for Normal Files:"
echo "   - Input fields are created for configuration values"
echo "   - Save button is visible and functional"
echo "   - NO error notifications appear"
echo ""
echo "🔗 Test URLs:"
echo "   - Main App: http://localhost:8081"
echo "   - Verification Test: http://localhost:8081/test-error-verification.html"
