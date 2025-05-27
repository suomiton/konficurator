/**
 * File Path Display Validation Script
 * Tests the enhanced path display functionality
 */

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', function () {
	console.log('🧪 File Path Display Validation Starting...');

	// Test 1: Check if path display elements are created correctly
	function testPathDisplayElements() {
		console.log('📋 Test 1: Path Display Elements');

		// Mock file data to test rendering
		const mockFileData = {
			name: 'test-config.json',
			path: '/Users/test/Documents/test-config.json',
			type: 'json',
			content: { test: 'data' },
			originalContent: '{"test": "data"}',
			handle: null
		};

		// Test renderer directly if available
		if (window.FormRenderer) {
			const renderer = new window.FormRenderer();
			const header = renderer.createFileHeader(mockFileData);

			const pathElement = header.querySelector('.file-path');
			if (pathElement) {
				console.log('✅ Path display element created');
				console.log('📁 Path text:', pathElement.textContent);

				// Verify it shows the actual path
				if (pathElement.textContent.includes('/Users/test/Documents/test-config.json')) {
					console.log('✅ Actual path displayed correctly');
				} else {
					console.log('❌ Expected actual path, got:', pathElement.textContent);
				}
			} else {
				console.log('❌ Path display element not found');
			}
		} else {
			console.log('⚠️ FormRenderer not available, skipping element test');
		}
	}

	// Test 2: Check storage functionality
	function testStorageFunctionality() {
		console.log('📋 Test 2: Storage Functionality');

		const testData = {
			name: 'stored-config.json',
			path: '/Users/test/stored-config.json',
			type: 'json',
			content: { stored: true },
			originalContent: '{"stored": true}',
			lastModified: Date.now(),
			size: 1024
		};

		try {
			// Test storage save
			localStorage.setItem('konficurator_test', JSON.stringify([testData]));
			console.log('✅ Storage save test passed');

			// Test storage load
			const loaded = JSON.parse(localStorage.getItem('konficurator_test'));
			if (loaded && loaded[0] && loaded[0].path) {
				console.log('✅ Storage load test passed');
				console.log('📁 Stored path:', loaded[0].path);
			} else {
				console.log('❌ Storage load test failed');
			}

			// Clean up
			localStorage.removeItem('konficurator_test');
		} catch (error) {
			console.log('❌ Storage test error:', error.message);
		}
	}

	// Test 3: Check CSS styling
	function testCSSStyleling() {
		console.log('📋 Test 3: CSS Styling');

		// Check if required CSS classes exist
		const style = getComputedStyle(document.documentElement);

		// Create a test element to check styling
		const testElement = document.createElement('div');
		testElement.className = 'file-path';
		document.body.appendChild(testElement);

		const computedStyle = getComputedStyle(testElement);

		console.log('🎨 CSS Properties:');
		console.log('   - Font size:', computedStyle.fontSize);
		console.log('   - Color:', computedStyle.color);
		console.log('   - Opacity:', computedStyle.opacity);

		// Clean up
		document.body.removeChild(testElement);
		console.log('✅ CSS styling check completed');
	}

	// Test 4: Check current storage state
	function testCurrentStorageState() {
		console.log('📋 Test 4: Current Storage State');

		try {
			const files = localStorage.getItem('konficurator_files');
			const version = localStorage.getItem('konficurator_version');

			if (files) {
				const parsed = JSON.parse(files);
				console.log(`📁 Found ${parsed.length} files in storage`);
				console.log('📋 Storage version:', version || 'unknown');

				parsed.forEach((file, index) => {
					console.log(`   ${index + 1}. ${file.name}`);
					if (file.path) {
						console.log(`      Path: ${file.path}`);
					} else {
						console.log('      Path: not stored');
					}
				});
			} else {
				console.log('📂 No files in storage');
			}
		} catch (error) {
			console.log('❌ Storage state check error:', error.message);
		}
	}

	// Run all tests
	console.log('🚀 Running File Path Display Validation Tests...');
	console.log('='.repeat(50));

	testPathDisplayElements();
	console.log('');
	testStorageFunctionality();
	console.log('');
	testCSSStyleling();
	console.log('');
	testCurrentStorageState();

	console.log('='.repeat(50));
	console.log('🏁 File Path Display Validation Complete');
	console.log('');
	console.log('📋 Next Steps:');
	console.log('1. Load sample files using "Select Configuration Files"');
	console.log('2. Check that file paths are displayed below filenames');
	console.log('3. Refresh page to test restored file path display');
	console.log('4. Verify mixed file scenarios work correctly');
});

// Export for manual testing
window.validateFilePathDisplay = {
	runTests: function () {
		document.dispatchEvent(new Event('DOMContentLoaded'));
	}
};
