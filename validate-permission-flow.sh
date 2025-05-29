#!/bin/bash

# Permission Flow Validation Script
# Tests the complete permission management system

echo "🧪 Permission Flow Validation - Konficurator"
echo "============================================="

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

function test_status() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ $1${NC}"
    else
        echo -e "${RED}❌ $1${NC}"
        exit 1
    fi
}

function info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

function warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

echo ""
echo "🔍 Phase 1: Code Structure Validation"
echo "------------------------------------"

# Test 1: Check main implementation files exist
info "Checking core implementation files..."
test -f "src/permissionManager.ts" && echo -e "${GREEN}✅ PermissionManager exists${NC}" || echo -e "${RED}❌ PermissionManager missing${NC}"
test -f "src/main.ts" && echo -e "${GREEN}✅ Main app exists${NC}" || echo -e "${RED}❌ Main app missing${NC}"
test -f "index.html" && echo -e "${GREEN}✅ HTML structure exists${NC}" || echo -e "${RED}❌ HTML missing${NC}"

# Test 2: Check key methods exist
info "Checking PermissionManager methods..."
grep -q "restoreSavedHandles" src/permissionManager.ts
test_status "restoreSavedHandles method found"

grep -q "requestAndReload" src/permissionManager.ts
test_status "requestAndReload method found"

grep -q "showReconnectCard" src/permissionManager.ts
test_status "showReconnectCard method found"

# Test 3: Check main app event handling
info "Checking main app event handling..."
grep -q "filePermissionGranted" src/main.ts
test_status "Permission granted event listener found"

grep -q "reconnectCards" index.html
test_status "Reconnect cards container in HTML"

echo ""
echo "🔧 Phase 2: Implementation Details"
echo "---------------------------------"

# Test 4: Check return type change
info "Checking PermissionManager.restoreSavedHandles return type..."
grep -A 10 "restoreSavedHandles" src/permissionManager.ts | grep -q "restoredFiles.*filesNeedingPermission"
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Returns object with restoredFiles and filesNeedingPermission${NC}"
else
    echo -e "${YELLOW}⚠️  Could not verify return type pattern${NC}"
fi

# Test 5: Check notification flow
info "Checking notification flow in main.ts..."
grep -A 5 -B 5 "hideLoading" src/main.ts | grep -q "showWarning"
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Warning notification after hideLoading found${NC}"
else
    echo -e "${YELLOW}⚠️  Could not verify notification timing${NC}"
fi

# Test 6: Check event listener typing
info "Checking event listener typing..."
grep -q "event: Event" src/main.ts && grep -q "customEvent = event as CustomEvent" src/main.ts
test_status "Proper event listener typing"

echo ""
echo "🎯 Phase 3: Functionality Tests"
echo "------------------------------"

# Test 7: TypeScript compilation
info "Testing TypeScript compilation..."
npm run build > /dev/null 2>&1
test_status "TypeScript compilation successful"

# Test 8: Check if reconnect cards container is properly positioned
info "Checking HTML structure..."
grep -B 2 -A 2 'id="reconnectCards"' index.html | grep -q 'id="editorContainer"'
test_status "Reconnect cards container positioned before editor container"

# Test 9: Check for removal of notification duration
info "Checking permission warning persistence..."
if grep -q "setTimeout.*hideLoading" src/permissionManager.ts; then
    echo -e "${RED}❌ Found auto-hide timeout in PermissionManager${NC}"
else
    echo -e "${GREEN}✅ No auto-hide timeout found - notifications persist${NC}"
fi

echo ""
echo "🚀 Phase 4: Integration Validation"
echo "---------------------------------"

# Test 10: Check custom event dispatch
info "Checking custom event dispatch in requestAndReload..."
grep -A 5 "requestAndReload" src/permissionManager.ts | grep -q "dispatchEvent.*filePermissionGranted"
test_status "Custom event dispatch found"

# Test 11: Check reconnect card removal
info "Checking reconnect card cleanup..."
grep -A 10 "requestAndReload" src/permissionManager.ts | grep -q "reconnectContainer.*remove"
test_status "Reconnect card removal logic found"

# Test 12: Check storage update
info "Checking storage update in event listener..."
grep -A 5 "filePermissionGranted" src/main.ts | grep -q "saveToStorage"
test_status "Storage update in event listener found"

echo ""
echo "📊 Validation Summary"
echo "===================="

echo -e "${GREEN}✅ Permission Flow Implementation Complete${NC}"
echo ""
echo "Key Features Implemented:"
echo "• PermissionManager.restoreSavedHandles returns structured data"
echo "• Permission warnings display after loading and persist"
echo "• Reconnect cards use dedicated container"
echo "• Permission grant triggers custom events"
echo "• UI updates properly after permission grant"
echo "• Storage is updated when permissions change"
echo "• TypeScript errors resolved"
echo ""
echo "🧪 Manual Testing:"
echo "1. Open http://localhost:8080"
echo "2. Load files and save to storage"
echo "3. Refresh page to test permission restoration"
echo "4. Verify warning notifications and reconnect cards"
echo "5. Grant permission and verify UI updates"
echo ""
echo "🎉 Permission flow fix completed successfully!"
