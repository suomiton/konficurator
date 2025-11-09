# WebAssembly Parser Responsibilities

The WebAssembly core lives under `parser-wasm/` and is compiled from Rust to provide lossless, high-performance updates for JSON, XML, and `.env` files.

## Entry points

- `parser-wasm/src/lib.rs` exposes the `update_value` binding consumed by `src/persistence.ts`. The function validates syntax, locates the span of the requested value, and returns new content with the replacement applied without reformatting the rest of the file.
- The same module exports `JsonParser`, `XmlParser`, and `EnvParser` types for use in integration tests.

## Format-specific components

| Format | Parser module | Key responsibilities |
| --- | --- | --- |
| JSON | `json_lexer.rs`, `json_parser.rs` | Tokenises JSON into spans, validates syntax, and replaces scalar or composite values. Literal detection ensures booleans, numbers, arrays, and objects retain their original representation. |
| XML / .config | `xml_parser.rs` | Navigates DOM-like structures, matching element paths (including `@attribute` selectors) and producing byte spans so replacements can escape values while preserving whitespace. |
| ENV | `env_parser.rs` | Parses line-oriented `KEY=VALUE` pairs, handling comments, quoted values, and whitespace while guaranteeing that updates only change the targeted entry. |

All parsers implement a shared `BytePreservingParser` trait (defined in `env_parser.rs`) that provides consistent span discovery and replacement APIs used by `update_value`.

## Memory and performance choices

- `wee_alloc` replaces the default allocator to shrink the binary and minimise overhead in the browser runtime (`lib.rs`).
- `serde_json::Value` is only used for literal detection so that structured JSON edits can respect numbers and nested objects.
- Format-specific escaping helpers (e.g., `escape_json_string`, `escape_xml_string`, `escape_env_string`) ensure the replaced fragments remain syntactically valid without reserialising the whole document.

## Testing

`parser-wasm/src/tests.rs` exercises end-to-end updates across supported formats, ensuring that span detection and replacement work together. When running `npm run build` or `npm run test` inside `parser-wasm/`, `wasm-pack` compiles the bindings and Cargo executes the Rust test suite.
