#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { minify: terserMinify } = require('terser');
const CleanCSS = require('clean-css');
const { minify: htmlMinify } = require('html-minifier-terser');

const distDir = path.join(__dirname, '..', 'dist');
const buildDir = path.join(__dirname, '..', 'build');
const stylesDir = path.join(__dirname, '..', 'styles');
const rootDir = path.join(__dirname, '..');

// Ensure build directory exists
if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
}

// Copy and create build structure
const buildStructure = {
    'dist': path.join(buildDir, 'dist'),
    'styles': path.join(buildDir, 'styles'),
    'samples': path.join(buildDir, 'samples')
};

Object.values(buildStructure).forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

console.log('🔨 Starting optimization process...');

// Minify JavaScript files
async function minifyJS() {
    console.log('📦 Minifying JavaScript files...');
    
    if (!fs.existsSync(distDir)) {
        console.error('❌ No dist directory found. Run "npm run build:ts" first.');
        process.exit(1);
    }

    const jsFiles = fs.readdirSync(distDir).filter(file => file.endsWith('.js'));
    
    for (const file of jsFiles) {
        const inputPath = path.join(distDir, file);
        const outputPath = path.join(buildStructure.dist, file);
        
        try {
            const code = fs.readFileSync(inputPath, 'utf8');
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
            
            fs.writeFileSync(outputPath, result.code);
            
            const originalSize = fs.statSync(inputPath).size;
            const minifiedSize = fs.statSync(outputPath).size;
            const savings = Math.round((1 - minifiedSize / originalSize) * 100);
            
            console.log(`   ✅ ${file}: ${originalSize} → ${minifiedSize} bytes (${savings}% smaller)`);
        } catch (error) {
            console.error(`   ❌ Error minifying ${file}:`, error.message);
        }
    }
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

// Minify HTML files
async function minifyHTML() {
    console.log('📄 Minifying HTML files...');
    
    const htmlFiles = ['index.html'];
    
    for (const file of htmlFiles) {
        const inputPath = path.join(rootDir, file);
        const outputPath = path.join(buildDir, file);
        
        if (!fs.existsSync(inputPath)) {
            console.warn(`⚠️  ${file} not found, skipping`);
            continue;
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
            
            fs.writeFileSync(outputPath, result);
            
            const originalSize = fs.statSync(inputPath).size;
            const minifiedSize = fs.statSync(outputPath).size;
            const savings = Math.round((1 - minifiedSize / originalSize) * 100);
            
            console.log(`   ✅ ${file}: ${originalSize} → ${minifiedSize} bytes (${savings}% smaller)`);
        } catch (error) {
            console.error(`   ❌ Error minifying ${file}:`, error.message);
        }
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
        
        const originalSize = calculateDirSize(distDir) + calculateDirSize(stylesDir) + fs.statSync(path.join(rootDir, 'index.html')).size;
        const optimizedSize = calculateDirSize(buildDir);
        const totalSavings = Math.round((1 - optimizedSize / originalSize) * 100);
        
        console.log(`📊 Total size: ${originalSize} → ${optimizedSize} bytes (${totalSavings}% reduction)`);
        
    } catch (error) {
        console.error('❌ Optimization failed:', error.message);
        process.exit(1);
    }
}

// Run optimization
optimize();
