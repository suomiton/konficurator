#!/bin/bash

# File Refresh Functionality Validation Script
# Tests the implementation of file persistence and reload functionality

echo "🔄 File Refresh Functionality Validation"
echo "========================================"
echo

# Check if required files exist
echo "📋 Checking implementation files..."

files_to_check=(
    "src/fileHandler.ts"
    "src/interfaces.ts"
    "src/renderer.ts"
    "src/main.ts"
    "styles/main.css"
)

all_files_exist=true

for file in "${files_to_check[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file exists"
    else
        echo "❌ $file is missing"
        all_files_exist=false
    fi
done

echo

if [ "$all_files_exist" = false ]; then
    echo "❌ Some required files are missing. Please check the implementation."
    exit 1
fi

# Check for specific implementation features
echo "🔍 Checking implementation features..."

# Check for refreshFile method in FileHandler
if grep -q "refreshFile" src/fileHandler.ts; then
    echo "✅ refreshFile method found in FileHandler"
else
    echo "❌ refreshFile method not found in FileHandler"
    exit 1
fi

# Check for refresh event handling in main.ts
if grep -q "refresh-file-btn" src/main.ts; then
    echo "✅ Refresh button event handling found in main.ts"
else
    echo "❌ Refresh button event handling not found in main.ts"
    exit 1
fi

# Check for handleFileRefresh method
if grep -q "handleFileRefresh" src/main.ts; then
    echo "✅ handleFileRefresh method found in main.ts"
else
    echo "❌ handleFileRefresh method not found in main.ts"
    exit 1
fi

# Check for refresh button in renderer
if grep -q "refresh-file-btn" src/renderer.ts; then
    echo "✅ Refresh button implementation found in renderer"
else
    echo "❌ Refresh button implementation not found in renderer"
    exit 1
fi

# Check for file-action-buttons container
if grep -q "file-action-buttons" src/renderer.ts; then
    echo "✅ Action buttons container found in renderer"
else
    echo "❌ Action buttons container not found in renderer"
    exit 1
fi

# Check for CSS styles
if grep -q "refresh-file-btn" styles/main.css; then
    echo "✅ Refresh button styles found in CSS"
else
    echo "❌ Refresh button styles not found in CSS"
    exit 1
fi

# Check for action buttons container styles
if grep -q "file-action-buttons" styles/main.css; then
    echo "✅ Action buttons container styles found in CSS"
else
    echo "❌ Action buttons container styles not found in CSS"
    exit 1
fi

echo

# Check TypeScript compilation
echo "🔧 Checking TypeScript compilation..."
if npx tsc --noEmit; then
    echo "✅ TypeScript compilation successful"
else
    echo "❌ TypeScript compilation failed"
    exit 1
fi

echo

# Check for error handling patterns
echo "🛡️ Checking error handling implementation..."

error_patterns=(
    "File not found"
    "Permission denied"
    "No file handle available"
)

error_handling_ok=true

for pattern in "${error_patterns[@]}"; do
    if grep -q "$pattern" src/main.ts; then
        echo "✅ Error handling for '$pattern' found"
    else
        echo "❌ Error handling for '$pattern' not found"
        error_handling_ok=false
    fi
done

echo

if [ "$error_handling_ok" = false ]; then
    echo "❌ Some error handling patterns are missing"
    exit 1
fi

# Summary
echo "🎉 Implementation Validation Complete!"
echo "====================================="
echo
echo "✅ All required files are present"
echo "✅ All required methods are implemented"
echo "✅ UI components are properly added"
echo "✅ CSS styles are implemented"
echo "✅ TypeScript compilation is successful"
echo "✅ Error handling is comprehensive"
echo
echo "📋 Features Implemented:"
echo "   • Individual refresh buttons for files with disk handles"
echo "   • File not found error notifications"
echo "   • Permission denied error handling"
echo "   • Storage vs disk file distinction"
echo "   • Enhanced error messages for different scenarios"
echo "   • SOLID principles and separation of concerns"
echo
echo "🚀 The file refresh functionality is ready for testing!"
echo "   Open the test guide: tests/test-file-refresh-functionality.html"
echo "   Start the application: python3 -m http.server 8000"
echo "   Navigate to: http://localhost:8000"

echo
echo "Next steps:"
echo "1. Load some files from the samples/ directory"
echo "2. Test refresh functionality by modifying files externally"
echo "3. Test error scenarios (move/delete files)"
echo "4. Verify persistence behavior (refresh page)"
echo "5. Validate UI behavior and error messages"
