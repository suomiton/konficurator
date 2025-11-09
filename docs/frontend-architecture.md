# Frontend Organisation

The frontend is written in TypeScript and compiled without a framework. Components are assembled from small modules so that rendering stays predictable and testable.

## Application controller

- `KonficuratorApp` (`src/main.ts`) coordinates all services. It attaches global listeners for file selection, save actions, refresh triggers, and permission events emitted by reconnect cards.
- The controller keeps an in-memory array of `FileData` entries, updates IndexedDB via `StorageService`, and orchestrates rendering by delegating to `ModernFormRenderer`.

## Rendering pipeline

- `ModernFormRenderer` (`src/ui/modern-form-renderer.ts`) is the single entry point for constructing editors. It stitches together:
  - **DOM factories** (`src/ui/dom-factory.ts`) that encapsulate element creation.
  - **Renderer helpers** (`src/ui/dom-renderer.ts`) that build headers, form sections, and save containers without state.
  - **Field data builders** (`src/ui/form-data.ts`) that derive the correct input configuration for nested objects, arrays, and primitives.
  - **Event wiring** (`src/ui/event-handlers.ts`) that registers per-field change handlers, save buttons, and file-level actions.
- Error states (parse failures, unsupported structures) are surfaced via `renderErrorNotification` and `renderErrorMessage` helpers, ensuring the UI communicates parsing issues immediately.

## Notifications and dialogs

- `NotificationService` (`src/ui/notifications.ts`) exposes static methods for success, error, info, and loading messages. It also provides inline containers that allow the app to surface File System Access errors before any editors are rendered.
- `ConfirmationDialog` (`src/confirmation.ts`) wraps confirmation prompts in a reusable component used when removing files or clearing storage.

## State persistence and toggles

- Editor visibility (e.g., whether a file is active) is stored alongside file metadata and restored on load. The renderer respects the `isActive` flag so users can collapse editors without losing selection state.
- The controller debounces save operations via `activeSaveOperations` to prevent duplicate writes when users click rapidly.

## Styles and layout

- Global styles live under `styles/`, while icons and inline labels are produced through `src/ui/icon.ts` so markup stays consistent. The UI emphasises accessibility by relying on semantic HTML elements combined with CSS classes.
