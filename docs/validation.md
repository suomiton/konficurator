# Validation pipeline

Syntax validation and JSON Schema validation run in Rust/WebAssembly. The frontend calls the generated exports directly.

## Syntax

`validate(type, content)` returns a summary. `validate_multi(type, content, maxErrors?)` returns `{valid, errors, summary}`. Each diagnostic contains a message, optional code, 1-based line and Unicode character column, and UTF-8 byte `start`/`end` offsets.

JSON uses strict serde validation and a bounded diagnostic scan after failure. ENV diagnostics come from the same scanner as `parse_tree` and updates; recovery comments faulty lines in a same-length validation buffer. Duplicate keys are accepted and indexed. XML checks qualified closing names and stops at its first trustworthy syntax or nesting error, avoiding speculative errors from restarting inside malformed markup.

## JSON Schema

Register schemas with `SchemaRegistry.register("group:filename", schemaObject)`. Lookup order is group/name, group/type, any-group/name, then any-group/type. The controller caches serialized schemas through `register_schema` and calls `validate_schema_with_id` after syntax passes.

The generated API also exposes `validate_schema(content, schema, options?)` for inline validation. Options include `maxErrors`, `collectPositions` and `draft` (4, 6, 7, 2019-09 or 2020-12). Schema error results include `instancePath`, `schemaPath`, keyword and optional positional fields. Missing optional values serialize as null. Required-property errors fall back to the parent object span.

External HTTP and file reference resolution is disabled. Schemas and file content remain in the browser.

## Editor integration

`FileEditorController` validates form previews and raw content. It stores diagnostics for mode changes. Raw error markers sit beside the contenteditable root and cannot become saved text. Raw autosave validates current syntax and any registered JSON schema before writing. Persistence also parses raw content before opening a writable stream. Content extraction retains original line endings, BOM, Unicode spaces and blank lines.

Validation is covered by native Rust tests and by JSDOM tests loading the real WASM binary, including registered-schema rejection during raw autosave.
