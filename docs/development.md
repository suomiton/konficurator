# Development Guide

## Setup

Use Node.js 22.13 or newer and stable Rust with the `wasm32-unknown-unknown` target:

```bash
npm ci
rustup target add wasm32-unknown-unknown
npm run dev
```

The root package supplies wasm-pack; the parser subdirectory has no duplicate build-tool installation. Vite serves development on port 5173.

## Build and test

- `npm run build` builds release WASM and the Vite bundle in `build/`.
- `npm run build:prod` cleans, builds, optimizes, compresses and verifies the static artifacts.
- `npm test` builds real Node WASM bindings and runs Jest in JSDOM. Parser and persistence imports are not mocked globally.
- `npm run test:coverage` runs the same suite with coverage.
- `npm run test:rust` runs native span and byte-for-byte regression tests.
- `npm run lint:rust` runs Clippy with warnings denied.
- `cargo fmt --manifest-path parser-wasm/Cargo.toml --check` checks Rust formatting.
- `npx tsc --noEmit`, `npm run lint`, and `npm run format:check` check TypeScript types, ESLint rules and formatting.

The generated web declarations are the frontend's only WASM API contract. `parser-wasm/pkg-node/` contains the equivalent Node build and is ignored by Git. Test setup adapts only module initialization; parsing, validation and replacement run inside the real WASM binary.

## Distribution

GitHub Actions runs the quality gates and publishes the static site to GitHub Pages. Container distribution uses a single Dockerfile with `development` and `production` targets:

```bash
docker compose up konficurator
docker compose --profile production up konficurator-prod
```

Both serve on localhost (ports 8080 and 8085 respectively). The production image serves static assets through nginx; file contents stay in the browser. `npm run build:prod` also produces artifacts for any static hosting service.
