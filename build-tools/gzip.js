#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const buildDir = path.join(__dirname, '..', 'build');

console.log('🗜️  Starting gzip compression...');

function gzipFile(filePath) {
	return new Promise((resolve, reject) => {
		const gzipPath = filePath + '.gz';
		const readStream = fs.createReadStream(filePath);
		const writeStream = fs.createWriteStream(gzipPath);
		const gzipStream = zlib.createGzip({ level: 9 });

		readStream
			.pipe(gzipStream)
			.pipe(writeStream)
			.on('finish', () => {
				const originalSize = fs.statSync(filePath).size;
				const gzippedSize = fs.statSync(gzipPath).size;
				const savings = Math.round((1 - gzippedSize / originalSize) * 100);

				console.log(`   ✅ ${path.basename(filePath)}: ${originalSize} → ${gzippedSize} bytes (${savings}% smaller)`);
				resolve();
			})
			.on('error', reject);
	});
}

async function gzipDirectory(dirPath) {
	if (!fs.existsSync(dirPath)) {
		console.warn(`⚠️  Directory ${dirPath} not found, skipping`);
		return;
	}

	const items = fs.readdirSync(dirPath);

	for (const item of items) {
		const itemPath = path.join(dirPath, item);
		const stats = fs.statSync(itemPath);

		if (stats.isDirectory()) {
			await gzipDirectory(itemPath);
		} else if (stats.isFile()) {
			const ext = path.extname(item).toLowerCase();

			// Only gzip text-based files
			if (['.html', '.css', '.js', '.json', '.xml', '.txt', '.md'].includes(ext)) {
				try {
					await gzipFile(itemPath);
				} catch (error) {
					console.error(`   ❌ Error gzipping ${item}:`, error.message);
				}
			}
		}
	}
}

async function createBrotliFiles() {
	console.log('📦 Creating Brotli compressed files...');

	const brotliCompress = (filePath) => {
		return new Promise((resolve, reject) => {
			const brotliPath = filePath + '.br';
			const readStream = fs.createReadStream(filePath);
			const writeStream = fs.createWriteStream(brotliPath);
			const brotliStream = zlib.createBrotliCompress({
				params: {
					[zlib.constants.BROTLI_PARAM_QUALITY]: 11,
					[zlib.constants.BROTLI_PARAM_SIZE_HINT]: fs.statSync(filePath).size
				}
			});

			readStream
				.pipe(brotliStream)
				.pipe(writeStream)
				.on('finish', () => {
					const originalSize = fs.statSync(filePath).size;
					const brotliSize = fs.statSync(brotliPath).size;
					const savings = Math.round((1 - brotliSize / originalSize) * 100);

					console.log(`   ✅ ${path.basename(filePath)} (br): ${originalSize} → ${brotliSize} bytes (${savings}% smaller)`);
					resolve();
				})
				.on('error', reject);
		});
	};

	const processDirectory = async (dirPath) => {
		if (!fs.existsSync(dirPath)) return;

		const items = fs.readdirSync(dirPath);

		for (const item of items) {
			const itemPath = path.join(dirPath, item);
			const stats = fs.statSync(itemPath);

			if (stats.isDirectory()) {
				await processDirectory(itemPath);
			} else if (stats.isFile()) {
				const ext = path.extname(item).toLowerCase();

				// Only compress text-based files
				if (['.html', '.css', '.js', '.json', '.xml', '.txt', '.md'].includes(ext)) {
					try {
						await brotliCompress(itemPath);
					} catch (error) {
						console.error(`   ❌ Error creating Brotli for ${item}:`, error.message);
					}
				}
			}
		}
	};

	await processDirectory(buildDir);
}

// Create nginx configuration snippet
function createNginxConfig() {
	console.log('📝 Creating nginx configuration snippet...');

	const nginxConfig = `# Nginx configuration for Konficurator
# Add this to your server block

# Enable gzip compression
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_comp_level 6;
gzip_types
    text/plain
    text/css
    text/xml
    text/javascript
    application/javascript
    application/xml+rss
    application/json
    application/xml;

# Enable brotli compression (requires nginx-module-brotli)
# brotli on;
# brotli_comp_level 6;
# brotli_types
#     text/plain
#     text/css
#     text/xml
#     text/javascript
#     application/javascript
#     application/xml+rss
#     application/json
#     application/xml;

# Serve pre-compressed files
location ~* \\.(js|css|html|xml|json)$ {
    # Try to serve brotli first, then gzip, then original
    try_files $uri.br $uri.gz $uri =404;
    
    # Set proper content type for compressed files
    location ~ \\.br$ {
        add_header Content-Encoding br;
        add_header Vary Accept-Encoding;
    }
    
    location ~ \\.gz$ {
        add_header Content-Encoding gzip;
        add_header Vary Accept-Encoding;
    }
}

# Cache static assets
location ~* \\.(css|js|png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
`;

	fs.writeFileSync(path.join(buildDir, 'nginx-config.txt'), nginxConfig);
	console.log('   ✅ Nginx configuration saved to build/nginx-config.txt');
}

// Create Apache .htaccess file
function createApacheConfig() {
	console.log('📝 Creating Apache .htaccess file...');

	const htaccessConfig = `# Apache configuration for Konficurator

# Enable compression
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/plain
    AddOutputFilterByType DEFLATE text/html
    AddOutputFilterByType DEFLATE text/xml
    AddOutputFilterByType DEFLATE text/css
    AddOutputFilterByType DEFLATE application/xml
    AddOutputFilterByType DEFLATE application/xhtml+xml
    AddOutputFilterByType DEFLATE application/rss+xml
    AddOutputFilterByType DEFLATE application/javascript
    AddOutputFilterByType DEFLATE application/x-javascript
    AddOutputFilterByType DEFLATE application/json
</IfModule>

# Serve pre-compressed files
<IfModule mod_rewrite.c>
    RewriteEngine On
    
    # Check for brotli files
    RewriteCond %{HTTP:Accept-Encoding} br
    RewriteCond %{REQUEST_FILENAME}\\.br -f
    RewriteRule ^(.*)\\.(js|css|html|xml|json)$ $1.$2.br [L]
    
    # Check for gzip files
    RewriteCond %{HTTP:Accept-Encoding} gzip
    RewriteCond %{REQUEST_FILENAME}\\.gz -f
    RewriteRule ^(.*)\\.(js|css|html|xml|json)$ $1.$2.gz [L]
    
    # Set proper content type and encoding for compressed files
    <FilesMatch "\\.(js|css|html|xml|json)\\.br$">
        Header set Content-Encoding br
        Header set Vary Accept-Encoding
    </FilesMatch>
    
    <FilesMatch "\\.(js|css|html|xml|json)\\.gz$">
        Header set Content-Encoding gzip
        Header set Vary Accept-Encoding
    </FilesMatch>
</IfModule>

# Cache static assets
<IfModule mod_expires.c>
    ExpiresActive On
    ExpiresByType text/css "access plus 1 year"
    ExpiresByType application/javascript "access plus 1 year"
    ExpiresByType image/png "access plus 1 year"
    ExpiresByType image/jpg "access plus 1 year"
    ExpiresByType image/jpeg "access plus 1 year"
    ExpiresByType image/gif "access plus 1 year"
    ExpiresByType image/ico "access plus 1 year"
    ExpiresByType image/svg+xml "access plus 1 year"
</IfModule>
`;

	fs.writeFileSync(path.join(buildDir, '.htaccess'), htaccessConfig);
	console.log('   ✅ Apache .htaccess saved to build/.htaccess');
}

async function compress() {
	try {
		if (!fs.existsSync(buildDir)) {
			console.error('❌ No build directory found. Run "npm run build:optimize" first.');
			process.exit(1);
		}

		await gzipDirectory(buildDir);
		await createBrotliFiles();
		createNginxConfig();
		createApacheConfig();

		console.log('🎉 Compression complete!');
		console.log('📋 Generated files:');
		console.log('   • .gz files for gzip compression');
		console.log('   • .br files for Brotli compression');
		console.log('   • nginx-config.txt for Nginx configuration');
		console.log('   • .htaccess for Apache configuration');

	} catch (error) {
		console.error('❌ Compression failed:', error.message);
		process.exit(1);
	}
}

// Run compression
compress();
