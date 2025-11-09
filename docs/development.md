# Development Guide

## Prerequisites

- Node.js 16 or newer (for TypeScript compilation and dev tooling).
- Rust toolchain with `wasm-pack` (installed automatically via `npm install` or provided in `parser-wasm/package.json`).

## Install dependencies

```bash
npm install
```

## Build workflows

- **Development build**: `npm run build` compiles the WASM package in dev mode and runs the TypeScript compiler.
- **Production build**: `npm run build:prod` performs a clean build, compiles the WASM module in release mode, transpiles TypeScript, minifies assets, and generates pre-compressed bundles.
- **Serve locally**: `npm run serve` starts a static server on `http://localhost:8080`. Run `npm run dev` to build once and serve in a single command.

To rebuild the WebAssembly parser by itself, run:

```bash
cd parser-wasm
npm run build # uses wasm-pack --target web
```

## Testing

- **TypeScript tests**: `npm test` runs the Jest suite with the JSDOM environment configured in `jest.config.cjs`.
- **Rust tests**: inside `parser-wasm/`, run `npm test` or `cargo test` to execute the span and replacement coverage defined in `src/tests.rs`.

## Linting and type checking

The project relies on TypeScript's compiler checks. Run `npm run build:ts` or `npm run build` to surface type errors. ESLint integration is configured via `tsconfig.eslint.json` for editors.

## Deployment

The repository ships Dockerfiles for local container builds (`Dockerfile.dev`, `Dockerfile.prod`) and uses GitHub Actions (`.github/workflows/ci.yml`, `deploy.yml`) to run tests and publish the static site to GitHub Pages.
