import { defineConfig } from "vite";
import path from "node:path";

export default defineConfig({
	root: path.resolve(__dirname),
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "src"),
		},
		extensions: [".mjs", ".js", ".ts", ".jsx", ".tsx", ".json"],
	},
	server: {
		open: true,
		port: 5173,
		fs: {
			allow: [path.resolve(__dirname), path.resolve(__dirname, "parser-wasm")],
		},
	},
	build: {
		outDir: path.resolve(__dirname, "build"),
		emptyOutDir: true,
		sourcemap: true,
		rollupOptions: {
			input: path.resolve(__dirname, "index.html"),
		},
	},
	optimizeDeps: {
		exclude: ["../parser-wasm/pkg/parser_core.js"],
	},
});
