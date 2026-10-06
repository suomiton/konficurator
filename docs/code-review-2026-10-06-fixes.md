# Code review remediation — 2026-10-06

This records the implementation changes for [the October 3 review](code-review-2026-10-03.md). The original review remains unchanged.

| Findings | Resolution |
| --- | --- |
| D1–D6, D13, D16 | Rust `parse_tree` supplies literal path segments, indexed array items/XML siblings, decoded keys, exact token text and original types. Form inputs carry encoded array paths and string baselines. Persistence edits leaves individually. .NET attributes retain their actual XML paths. |
| D7 | Error overlays are siblings of the editable root. Raw content extraction preserves line endings, BOM and blank lines. Parsing and schema validation happen before autosave; invalid syntax never opens a writable stream. |
| D8–D9 | ENV quotes, escaped quotes, exports, comment boundaries, multiline values and duplicate occurrences use one scanner for display and writing. The browser file reader retains BOM bytes instead of consuming them through `Blob.text()`. |
| D10–D12, D15 | XML handles qualified names, repeated siblings, empty elements and CDATA; closing names must match. Parent whitespace cannot be replaced. Text padding and context-specific escaping are retained. JSON updates use strict syntax validation. |
| D14, S4 | Central file detection recognizes `.env.*`, `.properties` and `.ini`; restored `.config` files use the same content sniffing as newly opened files. |
| S1–S3 | Schema calls use the actual Rust export names. Generated package declarations are the only WASM API declaration. ENV errors come solely from the shared Rust scanner. |
| S5–S6, S8–S9 | Removed TypeScript serialization and parser-registration paths, obsolete array textarea handling, per-field/deprecated callbacks, generic Save-button matching and DOM polling. Renderers return their forms; raw failures are handled before writing without message classification. |
| S7 | Save scheduling and workspace restoration have dedicated controllers. Saves are serialized by file id and retain queued edits. Restored files merge by stable id, preserving identical names across groups. |
| S10–S11 | Consistent formatting, typed optional properties, ESLint configuration, one wasm-pack dependency, one Dockerfile with two targets, one implementation of each build script. Removed obsolete validation scripts and deployment wrapper. |
| R1–R6, R8–R9 | Shared model/trait, centralized Unicode positions, serialized result structs, strict path arguments, original quote metadata and a single parse for updates. XML validation stops at its first trustworthy error. Clippy warnings are fixed; lexer debug printing and Finnish comments are removed. |
| R7 | Default allocator; unused direct dependencies removed; schema cache uses thread-local `RefCell`/`Rc`; maintained jsonschema dependency with external resolution disabled; wasm-opt enabled. |
| X1–X3 | Filename and field-label display uses text nodes. Reconnect-card lookup compares dataset values without filename interpolation in selectors. README explains unencrypted complete-content storage in IndexedDB. |
| X4, tests/tooling | CI uses the maintained Rust toolchain action and the root npm wasm-pack dependency, with current coverage tooling. It runs Cargo tests, warning-free Clippy, formatting, TypeScript, ESLint, real-WASM Jest tests and production builds. No Jest files or suites are ignored for parser compatibility. |

Rust result structs serialize through serde and `js_sys::JSON::parse`; the generated API includes a Rust TypeScript custom section. This replaces the original Reflect boilerplate without adding a second serialization dependency. XML recovery intentionally reports one trusted error instead of restarting tokenization inside malformed markup.

Native golden files compare complete UTF-8 bytes, including BOM and CRLF. JSDOM tests load the real Node WASM build and exercise parsing, rendering, persistence, structural JSON array edits, raw validation, schema validation, unsafe filenames and same-name restoration. Docker remains an optional static distribution method; it does not receive configuration contents.

## Validation results

- 296 Jest tests pass across 29 suites, using the real WASM parser; no tests or suites are skipped.
- 32 native Rust tests pass, including golden files.
- TypeScript, ESLint, Prettier, rustfmt and Clippy with warnings denied pass.
- The optimized production build and its asset verification pass.
- `docker compose config --quiet` validates the consolidated container configuration. Container images were not built locally.
