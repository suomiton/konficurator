# Validation Pipeline (Rust + WASM)

This document describes the enhanced validation system added in November 2025. It introduces multi‑error surfacing for JSON/XML, positional ENV errors, and pure‑Rust JSON Schema validation compiled to WebAssembly.

## Overview

The validation flow now proceeds in distinct stages:

1. Syntax (WASM) – Fast, language-specific syntax validation executed inside Rust.
2. Multi-error collection (optional) – For JSON/XML we gather up to N errors with precise spans.
3. Schema validation (optional JSON) – After syntax passes, JSON Schema rules are applied using a Rust validator.
4. UI rendering – The first (summary) error is shown in the badge. Additional errors (if any) are available for tooltip / future expansion.

All validation steps are performed client-side; no server round-trip is required.

## WASM Exports

### `validate(fileType, content)`
Returns a summary only (first error or success):
```
{
  valid: boolean,
  message?: string,
  line?: number,
  column?: number,
  start?: number,
  end?: number
}
```
Use this for lightweight checks when multi-error details aren’t needed.

### `validate_multi(fileType, content, maxErrors?)`
Collects multiple syntax-level errors.
```
{
  valid: boolean,
  errors: [
    {
      message: string,
      code?: string,          // e.g. json.unterminated_string
      line: number,
      column: number,
      start: number,          // byte offset
      end: number             // byte offset (exclusive)
    }
  ],
  summary?: {                 // mirrors first error for convenience
    message: string,
    line: number,
    column: number,
    start: number,
    end: number
  }
}
```
`maxErrors` defaults to 3 and is clamped to an internal constant (`MAX_MULTI_ERRORS`).

### `register_schema(schemaId, schema)`
Registers a JSON Schema (as raw JSON text) under an identifier. Schemas are cached in Rust for reuse.

### `validate_schema(content, schema, options?)`
Validates a JSON document against a provided schema string.

### `validate_schema_with_id(content, schemaId, options?)`
Validates using a previously registered schema.

Schema result shape:
```
{
  valid: boolean,
  errors?: [
    {
      message: string,
      keyword?: string,       // schema keyword (type, required, etc.)
      instancePath: string,   // JSON Pointer (e.g. /server/port)
      schemaPath?: string,    // Pointer into the schema
      line?: number,          // Optional (can be disabled)
      column?: number,
      start?: number,
      end?: number
    }
  ]
}
```
`options`:
- `maxErrors?: number` – limit error collection.
- `collectPositions?: boolean` – default true; when false positional fields are omitted.
- `draft?: string` – reserved for future draft selection.

## Language Specifics

### JSON
- Primary syntax parse uses `serde_json`. On failure we compute a more precise span via a lightweight lexer (`infer_json_span`).
- Multi-error path performs a lenient scan, recovering from common anomalies:
  - Unterminated string → `json.unterminated_string`
  - Missing colon in object member → `json.missing_colon`
  - Missing comma between elements → `json.missing_comma`
  - Trailing comma → `json.trailing_comma`
  - Structural mismatch (braces/brackets) → `json.unbalanced_structure`

### XML / CONFIG
- Tokenization with `xmlparser` continues past errors using a simple resync strategy (jump to next `<`).
- Each collected error includes position; spans may be minimal when precise end delimiters cannot be inferred.

### ENV
- Single-error positional reporting (missing `=`, unterminated quoted value, duplicate key).
- Exposed through `validate` and wrapped in `validate_multi` for shape consistency.

## UI Integration (`src/main.ts`)

1. Raw and form modes both call syntax validation first (`validate_multi`).
2. If invalid: first error sets badge state, raw editor scrolls to error line and applies `.has-error`.
3. If valid and file type is JSON and a schema is registered (`SchemaRegistry.getForFile`), run `validate_schema`.
4. Store full error meta in `lastValidationMeta` to reapply decorations after re-renders or mode switches.

### Badge Behavior
- Shows `Valid` or `Invalid (message)`.
- Tooltip (when errors present) lists line/column for first error and may expand to include others (future enhancement).

### Raw Editor Decoration
- Adds state classes: `.raw-editor.has-error`, `.raw-editor.is-valid`.
- Smooth scroll to first error line using computed line height and padding.

## Schema Registry (`src/validation/schemaRegistry.ts`)

Lookup priority:
1. `group:name`
2. `group:type`
3. `*:name`
4. `*:type`

Register example:
```ts
import { SchemaRegistry } from "./validation/schemaRegistry";
SchemaRegistry.register("payments:app-config.json", mySchemaObject);
```
The UI then automatically invokes `validate_schema` after syntax success.

## Error Spans & Positions

- `line` / `column` are 1-based.
- `start` / `end` are byte offsets (for UTF-8 slicing / decoration alignment).
- When span end cannot be confidently inferred, `end = start`.
- Schema `required` errors map to the parent object span; missing property itself has no span.

## Performance Considerations

- Multi-error collection caps at a small number (default 3) to keep UI responsive.
- Large file safeguard (future): early exit or reduced error cap above a size threshold (>1 MB).
- Schema compilation is cached; repeated validations only traverse the instance document.

## Adding New Languages / Validators

1. Implement a parser/lexer producing spans.
2. Provide `validate_*_multi(content, cap)` returning `MultiValidationResult`.
3. Map single-error path through `validate` for quick checks.
4. (Optional) Add schema or advanced rule validator following the JSON pattern.

## Rust Types (Internal)

```rust
pub struct DetailedError {
  pub message: String,
  pub code: Option<&'static str>,
  pub line: usize,
  pub column: usize,
  pub span: Span,
}

pub struct MultiValidationResult {
  pub valid: bool,
  pub summary: Option<DetailedError>,
  pub errors: Vec<DetailedError>,
}
```

## Testing Strategy

- Rust unit tests cover: multi-error collection (JSON/XML), ENV positional, schema validation (type, required, disabled positions).
- TypeScript tests assert UI badge class toggling and raw editor decoration state.
- Future: Add TS integration test for `validate_multi` once ESM named exports are stable under Jest.

## Migration Notes

- Existing consumers of `validate` remain unaffected; multi-error & schema layers are additive.
- Badge logic now reads either simple meta or aggregated meta; no breaking DOM changes.

## Future Enhancements

- Expose structured recovery hints (e.g. suggest adding missing colon).
- Include error severity levels.
- Add debounce for schema validation separate from raw edits.
- Persist last N schema errors in storage for reopening sessions.

---
For deeper Rust integration details see `rust-parser.md`.
