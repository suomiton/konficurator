# File System Access Workflow

Konficurator relies on the browser's File System Access API to keep editing entirely local to the user. The integration is concentrated in a few modules so the rest of the app can stay agnostic of browser specifics.

## Selecting and opening files

- `FileHandler.selectFiles` (`src/fileHandler.ts`) triggers the picker with JSON, XML, `.config`, and `.env` filters, reads each handle, and captures metadata such as the original path, `lastModified` timestamp, and size.
- `FileHandler.readFile` and `FileHandler.writeFile` provide simple wrappers around `getFile()`/`createWritable()` so other modules can refresh or save content without duplicating API calls.
- `FileHandler.refreshFile` re-validates existing handles and re-detects file types so the UI stays in sync when users change files outside the app.

## Persisting handles between sessions

- `StorageService.saveFiles` (`src/handleStorage.ts`) stores `FileData` records in IndexedDB, including optional `FileSystemFileHandle` references and user toggle state.
- `StorageService.loadFiles` restores the cached records, re-detects ambiguous `.config` file formats, and tags files that lost permission so the UI can prompt the user.
- `StorageService.autoRefreshFiles` attempts to reread disk-backed files automatically whenever handles remain valid.

## Permissions and reconnection

- `PermissionManager.restoreSavedHandles` (`src/permissionManager.ts`) loops through stored files, calling `queryPermission` on each handle. Granted handles are reloaded immediately; denied handles surface “reconnect” cards that let users re-authorize access.
- `PermissionManager.requestAndReload` drives the reconnect flow. After a user grants permission, it refreshes file contents via `getFile()` and updates UI state.

## Non-destructive saving

- `FilePersistence.saveFile` (`src/persistence.ts`) initialises the WASM bindings, collects form changes, and applies them via `update_value` while keeping the original handle. If a handle is unavailable (restored from storage only), it falls back to prompting the user to download the updated content.
- Change detection covers text inputs, checkbox toggles, and JSON textarea arrays so that the WASM layer only processes modified paths.

This layered approach allows the UI to focus on rendering and interactions while browser-specific logic lives in the handler, storage, and permission modules.
