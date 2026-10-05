#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const buildDir = path.resolve(__dirname, '..', 'build');
const html = fs.readFileSync(path.join(buildDir, 'index.html'), 'utf8');
if (/\b(?:src|href)=["'][^"']*\.ts(?:[?"'])/.test(html)) {
	throw new Error('Production HTML references uncompiled TypeScript');
}

const assets = [...html.matchAll(/\b(?:src|href)=["'](\/assets\/[^"']+)["']/g)];
if (!assets.some(([, url]) => url.endsWith('.js'))) {
	throw new Error('Production HTML is missing its JavaScript entry point');
}
for (const [, url] of assets) {
	if (!fs.existsSync(path.join(buildDir, url.slice(1)))) {
		throw new Error(`Production HTML references missing asset: ${url}`);
	}
}
if (!fs.readdirSync(path.join(buildDir, 'assets')).some(name => name.endsWith('.wasm'))) {
	throw new Error('Production build is missing the WASM parser');
}
for (const extension of ['gz', 'br']) {
	if (!fs.existsSync(path.join(buildDir, `index.html.${extension}`))) {
		throw new Error(`Production build is missing index.html.${extension}`);
	}
}
console.log('Verified production HTML, bundled assets, WASM parser and compressed HTML');
