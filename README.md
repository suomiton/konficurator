# 🔧 Konficurator

[![CI](https://github.com/suomiton/konficurator/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/suomiton/konficurator/actions/workflows/ci.yml)
[![Deploy to GitHub Pages](https://github.com/suomiton/konficurator/actions/workflows/deploy.yml/badge.svg)](https://github.com/suomiton/konficurator/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)

🌐 **[Live Demo](https://suomiton.github.io/konficurator/)** · 🐛 **[Issues](https://github.com/suomiton/konficurator/issues)**

Konficurator is a browser-only configuration editor for JSON, XML, `.config`, and `.env` files. It combines a Rust-powered WebAssembly parser with a stateless TypeScript UI so that users can edit files locally without uploading sensitive data.

## 📚 Documentation

- [Architecture Overview](docs/overview.md)
- [WebAssembly Parser Responsibilities](docs/rust-parser.md)
- [File System Access Workflow](docs/file-system-access.md)
- [Frontend Organisation](docs/frontend-architecture.md)
- [Development Guide](docs/development.md)
- [Code Review 2026-10-03](docs/code-review-2026-10-03.md)

## ✨ Features

- **WebAssembly editing core** – Rust parsers compiled to WASM apply non-destructive updates for every supported format.
- **Multi-file workspace** – Load several configuration files at once, toggle visibility, and persist sessions in IndexedDB.
- **File System Access integration** – Read, refresh, and save directly to disk with automatic permission recovery.
- **Dynamic form rendering** – Generate nested editors for objects, arrays, attributes, and key-value pairs without manual templates.
- **Conflict-aware persistence** – Detect external file changes, surface merge actions, and prevent overwriting newer content.
- **Comprehensive notifications** – Provide contextual success, error, and loading states across the app lifecycle.

See the docs linked above for deeper explanations of each subsystem.

Session restoration stores complete file contents, including any `.env` secrets, unencrypted in IndexedDB in your browser profile. The app does not upload them. Removing a file from the session removes its cached record; clearing this site's browser data also removes the cache.

## 🖥 Browser support

Konficurator requires browsers that implement both WebAssembly and the File System Access API:

- Chrome 86+
- Edge 86+
- Opera 72+

Other browsers can view the interface but will not be able to open or save files.

## 🚀 Quick start

```bash
# Clone and install dependencies
git clone https://github.com/suomiton/konficurator.git
cd konficurator
npm install

# Start the dev server with HMR (http://localhost:5173)
npm run dev
```

Visit `http://localhost:5173` in a supported browser, choose **Select Configuration Files**, and start editing.

## 🧱 Project structure

```
konficurator/
├── src/                # TypeScript sources and UI modules
├── parser-wasm/        # Rust parser core compiled to WebAssembly
├── docs/               # Living documentation for architecture and workflows
├── styles/             # CSS assets
├── tests/              # Jest test suites
├── build-tools/        # Optimisation scripts for production builds
└── index.html          # Entry point served by GitHub Pages
```

## 🧪 Development and testing

- **Local dev server** – `npm run dev` compiles the WASM bindings (dev profile) and starts Vite with hot module reloading.
- **Build** – `npm run build` compiles the WASM bindings in release mode and produces a Vite bundle in `build/`.
- **Production build** – `npm run build:prod` runs the optimised pipeline with minification and pre-compression.
- **TypeScript tests** – `npm test` builds the Node WASM target and executes Jest in JSDOM against the real parser and persistence modules.
- **Rust tests** – `npm run test:rust` runs native span and byte-for-byte regression tests.

Detailed workflows, including Docker usage and deployment scripts, are documented in [docs/development.md](docs/development.md).

## 📄 License

Konficurator is released under the [MIT License](LICENSE).
