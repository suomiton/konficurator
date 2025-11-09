#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { minify: terserMinify } = require('terser');
const CleanCSS = require('clean-css');
const { minify: htmlMinify } = require('html-minifier-terser');

// With Vite, the output directory is "build" (see vite.config.ts)
const buildDir = path.join(__dirname, '..', 'build');
// Treat the Vite output dir as the JS source we want to further optimize
const sourceDir = buildDir;
const stylesDir = path.join(__dirname, '..', 'styles');
const rootDir = path.join(__dirname, '..');

// Ensure build directory exists
if (!fs.existsSync(buildDir)) {
	fs.mkdirSync(buildDir, { recursive: true });
}

// Copy and create build structure (optimize in-place into build/)
const buildStructure = {
	'dist': buildDir, // keep key for backward-compatibility; now points to build/
	'styles': path.join(buildDir, 'styles'),
	'samples': path.join(buildDir, 'samples')
};

Object.values(buildStructure).forEach(dir => {
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}
});

console.log('🔨 Starting optimization process...');

// Minify JavaScript files recursively
async function minifyJS() {
	console.log('📦 Minifying JavaScript files...');

	if (!fs.existsSync(sourceDir)) {
		console.error('❌ No build directory found. Run "npm run build" first.');
		process.exit(1);
	}

	// Recursive function to process directories
	async function processDirectory(sourceDir, targetDir) {
		const items = fs.readdirSync(sourceDir);

		for (const item of items) {
			const sourcePath = path.join(sourceDir, item);
			const targetPath = path.join(targetDir, item);
			const stat = fs.statSync(sourcePath);

			if (stat.isDirectory()) {
				// Create directory in target and process recursively
				if (!fs.existsSync(targetPath)) {
					fs.mkdirSync(targetPath, { recursive: true });
				}
				await processDirectory(sourcePath, targetPath);
			} else if (item.endsWith('.js')) {
				// Process JavaScript file
				try {
					const code = fs.readFileSync(sourcePath, 'utf8');
					const result = await terserMinify(code, {
						compress: {
							drop_console: true,
							drop_debugger: true,
							pure_funcs: ['console.log', 'console.info', 'console.debug'],
							passes: 2
						},
						mangle: {
							toplevel: true,
							properties: false
						},
						format: {
							comments: false
						},
						sourceMap: false
					});

					if (result.error) {
						throw result.error;
					}

					fs.writeFileSync(targetPath, result.code);

					const originalSize = fs.statSync(sourcePath).size;
					const minifiedSize = fs.statSync(targetPath).size;
					const savings = Math.round((1 - minifiedSize / originalSize) * 100);

					console.log(`   ✅ ${path.relative(sourceDir, sourcePath)}: ${originalSize} → ${minifiedSize} bytes (${savings}% smaller)`);
				} catch (error) {
					console.error(`   ❌ Error minifying ${path.relative(sourceDir, sourcePath)}:`, error.message);
				}
			}
		}
	}

	await processDirectory(sourceDir, buildStructure.dist);
}

// Minify CSS files
function minifyCSS() {
	console.log('🎨 Minifying CSS files...');

	if (!fs.existsSync(stylesDir)) {
		console.warn('⚠️  No styles directory found, skipping CSS minification');
		return;
	}

	const cssFiles = fs.readdirSync(stylesDir).filter(file => file.endsWith('.css'));
	const cleanCSS = new CleanCSS({
		level: 2,
		returnPromise: false
	});

	for (const file of cssFiles) {
		const inputPath = path.join(stylesDir, file);
		const outputPath = path.join(buildStructure.styles, file);

		try {
			const css = fs.readFileSync(inputPath, 'utf8');
			const result = cleanCSS.minify(css);

			if (result.errors.length > 0) {
				throw new Error(result.errors.join(', '));
			}

			fs.writeFileSync(outputPath, result.styles);

			const originalSize = fs.statSync(inputPath).size;
			const minifiedSize = fs.statSync(outputPath).size;
			const savings = Math.round((1 - minifiedSize / originalSize) * 100);

			console.log(`   ✅ ${file}: ${originalSize} → ${minifiedSize} bytes (${savings}% smaller)`);
		} catch (error) {
			console.error(`   ❌ Error minifying ${file}:`, error.message);
		}
	}
}

// Minify HTML file in-place under build/ (avoid overwriting Vite's generated HTML)
async function minifyHTML() {
	console.log('📄 Minifying HTML files...');

	const inputPath = path.join(buildDir, 'index.html');
	if (!fs.existsSync(inputPath)) {
		console.warn('⚠️  build/index.html not found, skipping HTML minification');
		return;
	}

	try {
		const html = fs.readFileSync(inputPath, 'utf8');
		const result = await htmlMinify(html, {
			collapseWhitespace: true,
			removeComments: true,
			removeRedundantAttributes: true,
			removeScriptTypeAttributes: true,
			removeStyleLinkTypeAttributes: true,
			useShortDoctype: true,
			minifyCSS: true,
			minifyJS: true,
			removeEmptyAttributes: true,
			removeOptionalTags: true,
			sortAttributes: true,
			sortClassName: true
		});

		fs.writeFileSync(inputPath, result);
		console.log('   ✅ index.html minified in-place under build/');
	} catch (error) {
		console.error('   ❌ Error minifying index.html:', error.message);
	}
}

// Copy samples directory
function copySamples() {
	console.log('📋 Copying samples...');

	const samplesSource = path.join(rootDir, 'samples');
	if (!fs.existsSync(samplesSource)) {
		console.warn('⚠️  No samples directory found, skipping');
		return;
	}

	const copyRecursive = (src, dest) => {
		if (fs.statSync(src).isDirectory()) {
			if (!fs.existsSync(dest)) {
				fs.mkdirSync(dest, { recursive: true });
			}
			fs.readdirSync(src).forEach(file => {
				copyRecursive(path.join(src, file), path.join(dest, file));
			});
		} else {
			fs.copyFileSync(src, dest);
		}
	};

	copyRecursive(samplesSource, buildStructure.samples);
	console.log('   ✅ Samples copied successfully');
}

// Main optimization function
async function optimize() {
	try {
		await minifyJS();
		minifyCSS();
		await minifyHTML();
		copySamples();

			// Remove any lingering untransformed .ts entrypoints accidentally copied into build/
			// (Should not happen with Vite, but defensive cleanup to prevent MIME/type issues)
			try {
				const strayTs = path.join(buildDir, 'src');
				if (fs.existsSync(strayTs)) {
					console.warn('⚠️  Removing unexpected build/src directory to avoid serving raw TS.');
					fs.rmSync(strayTs, { recursive: true, force: true });
				}
			} catch (e) {
				console.warn('⚠️  Cleanup warning:', e.message);
			}

		console.log('🎉 Optimization complete! Files are ready in the build/ directory');

		// Calculate total size savings
		const calculateDirSize = (dirPath) => {
			if (!fs.existsSync(dirPath)) return 0;

			let totalSize = 0;
			const files = fs.readdirSync(dirPath);

			for (const file of files) {
				const filePath = path.join(dirPath, file);
				const stats = fs.statSync(filePath);

				if (stats.isDirectory()) {
					totalSize += calculateDirSize(filePath);
				} else {
					totalSize += stats.size;
				}
			}

			return totalSize;
		};

	const optimizedSize = calculateDirSize(buildDir);
	console.log(`📊 Total optimized size in build/: ${optimizedSize} bytes`);

	} catch (error) {
		console.error('❌ Optimization failed:', error.message);
		process.exit(1);
	}
}

// Run optimization
optimize();
