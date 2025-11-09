# Konficurator Architecture Overview

Konficurator is a browser-first configuration file editor that keeps all parsing, persistence, and UI orchestration on the client. The codebase is split into focused modules so that each responsibility can evolve independently.

## High-level flow

1. **Entry point (`src/main.ts`)** instantiates the app controller, wires together services, and registers UI event listeners for selecting, editing, refreshing, and saving files.
2. **File selection (`src/fileHandler.ts`)** uses the File System Access API to open files and capture metadata needed to persist and render editors.
3. **Parsing (`src/parsers.ts`)** transforms the raw file content into structured data so that the renderer can build forms. Parser implementations are format-specific and extend a shared base class.
4. **Rendering (`src/ui/modern-form-renderer.ts`)** creates editor views by combining stateless DOM factories, renderer helpers, and event wiring modules located under `src/ui/`.
5. **Persistence (`src/persistence.ts`)** applies form changes by delegating to the WebAssembly parser and then writing the transformed content back to disk or prompting the user for a new download.
6. **Storage (`src/handleStorage.ts`)** caches file metadata and handles in IndexedDB so that sessions can be restored on reload, coordinating with the permission manager when user confirmation is required.

These stages communicate through `FileData` records (`src/interfaces.ts`), keeping business logic isolated from DOM manipulation.

## Supporting services

- **Notifications (`src/ui/notifications.ts`)** centralize toast-style messaging, including inline errors for unsupported browsers or failed file operations.
- **Permission management (`src/permissionManager.ts`)** reconciles persisted file handles with the browser’s current permissions, rendering “reconnect” cards if user interaction is needed.
- **Confirmation prompts (`src/confirmation.ts`)** provide a reusable dialog for destructive actions such as removing files.
- **Utility helpers (`src/utils/`)** contain detection logic that classifies file types, normalizes MIME hints, and ensures field names remain consistent across the UI.

## Data contracts

Interfaces in `src/interfaces.ts` keep the modules aligned: `FileData` describes the shape of a loaded file, `IParser`/`IRenderer` define capabilities exposed by parsing and rendering layers, and `IPersistence` abstracts saving. This contract-centric approach keeps modules testable and enables the WASM layer to evolve without touching the UI.
