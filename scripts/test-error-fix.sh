#!/bin/bash

echo "🧪 Testing Error Notification Fix"
echo "=================================="
echo

echo "1. Starting development server..."
cd /Users/tonisuominen/dev/konficurator
npm run build > /dev/null 2>&1

echo "2. Testing with problematic file: application.config"
echo "   Content preview:"
head -3 samples/application.config
echo "   ..."
echo

echo "3. Expected behavior:"
echo "   ✅ File should show error notification (yellow warning box)"
echo "   ✅ NO form fields should be displayed"
echo "   ✅ NO save button should be displayed"
echo "   ✅ Error message should mention 'Unsupported file type'"
echo

echo "4. To verify manually:"
echo "   - Open http://localhost:8080"
echo "   - Select 'application.config' from samples folder"
echo "   - Verify the above behavior"
echo

echo "5. Also test that JSON/XML files still work:"
echo "   - Select 'app-config.json' or 'server-config.xml'"
echo "   - Verify they show forms with save buttons"
echo

echo "✅ Test setup complete. Manual verification required in browser."
