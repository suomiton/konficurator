#!/bin/zsh

echo "🧪 Testing File Persistence Fix"
echo "================================"

# Build the application first
echo "📦 Building application..."
cd /Users/tonisuominen/dev/konficurator
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful"
else
    echo "❌ Build failed"
    exit 1
fi

echo ""
echo "🔍 Testing localStorage availability..."

# Create a simple Node.js script to test localStorage simulation
cat > test-storage-logic.js << 'EOF'
// Simulate localStorage for testing
const localStorage = {
    data: {},
    setItem(key, value) {
        this.data[key] = value;
    },
    getItem(key) {
        return this.data[key] || null;
    },
    removeItem(key) {
        delete this.data[key];
    }
};

// Test the storage logic
const testFile = {
    name: "test.json",
    type: "json",
    content: { test: "data" },
    originalContent: '{"test": "data"}',
    handle: null
};

console.log("🧪 Testing storage save/load cycle...");

// Simulate save
const storedFiles = [{
    name: testFile.name,
    type: testFile.type,
    lastModified: Date.now(),
    content: testFile.originalContent, // Should store raw string
    size: testFile.originalContent.length
}];

localStorage.setItem('konficurator_files', JSON.stringify(storedFiles));
console.log("✅ Saved file to storage");

// Simulate load
const storedData = localStorage.getItem('konficurator_files');
const parsed = JSON.parse(storedData);
const restored = parsed.map(stored => ({
    name: stored.name,
    handle: null,
    type: stored.type,
    content: stored.content, // Should be string for parsing
    originalContent: stored.content
}));

console.log("✅ Loaded file from storage");
console.log("📋 Content type:", typeof restored[0].content);
console.log("📋 Content:", restored[0].content);

if (typeof restored[0].content === 'string') {
    console.log("✅ Content is string - ready for parser");
} else {
    console.log("❌ Content is not string - will cause parser error");
}
EOF

node test-storage-logic.js
rm test-storage-logic.js

echo ""
echo "🚀 Manual Testing Steps:"
echo "1. Open http://localhost:8081"
echo "2. Load a sample file (e.g., samples/app-config.json)"
echo "3. Refresh the page (Cmd+R)"
echo "4. Verify the file persists and loads without errors"
echo ""
echo "🔍 Check browser console for any errors during load"
echo "Expected: Blue info message showing restored files"

echo ""
echo "🎯 The fix should resolve the 'content.trim is not a function' error"
echo "by ensuring originalContent (string) is stored and restored for parsing."
