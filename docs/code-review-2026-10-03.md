# Code Review — 2026-10-03

Scope: the whole application (`parser-wasm/` Rust core, `src/` TypeScript UI, tests, CI) evaluated against the product goals:

- Edit JSON, XML and plain-text (ENV) configs with every property shown as an editable input.
- Work with collections and arrays of values.
- On save, change **only** the edited value. No reformatting. Version-control friendly.
- Offline tool for local files.

Every finding marked **Verified** was reproduced by running the Rust crate natively against corner-case inputs and by driving the real `ModernFormRenderer` + `FilePersistence` pipeline in jsdom with a recording WASM stub. Findings marked **Code-read** come from reading the code and were not executed.

Baseline at review time: `npx tsc --noEmit` clean; `npm test` 274 passed, 3 skipped, 1 suite skipped; `cargo test` 23 passed; `cargo clippy` 33 warnings.

---

## 1. Verdict

The architecture is right in outline: Rust locates a byte span and splices only that span. In practice the save path is not lossless, because:

1. The TypeScript layer builds paths and values in a shape the Rust finder cannot resolve, or that corrupts the value before it reaches Rust.
2. The Rust JSON span finder has a correctness bug for arrays of objects.
3. Two independent grammars per format (TS for display, Rust for writing) disagree on quoting, comments, type coercion and key/value flattening.
4. Nothing tests the real round trip: Jest mocks both the WASM module and the persistence module, and CI never runs `cargo test`.

---

## 2. Data-integrity findings (violate "only change the value")

| ID | Severity | Status | Finding | Where |
| --- | --- | --- | --- | --- |
| D1 | Critical | Verified | Field paths are split on `.`, so any key containing a dot cannot be saved. | `src/persistence.ts:189`, `:206`, `:225`, `:255` |
| D2 | Critical | Verified | Arrays are re-serialised whole as a JSON array of **strings**; arrays of objects render as `[object Object]`. | `src/persistence.ts:248-286`, `src/ui/dom-renderer.ts:270` |
| D3 | Critical | Verified | Rust JSON path finder increments the array index on every comma, including commas inside nested objects, so `servers/1/port` resolves to the wrong element. | `parser-wasm/src/json_parser.rs:164-172` |
| D4 | High | Verified | XML and ENV display parsers coerce numeric-looking strings (`0401234567` → `401234567`, `1.10` → `1.1`, `02100` → `2100`). | `src/parsers.ts:198-203`, `:327-332` |
| D5 | High | Verified | Rust retypes JSON values by the *new* text, not the original token: `"1.0"` edited to `2` becomes number `2`; `"yes"` edited to `true` becomes a boolean. | `parser-wasm/src/lib.rs:76-80`, `:483-494` |
| D6 | High | Verified | .NET `web.config` / `app.config` cannot be edited from the form: root-level `<add key= value=/>` is flattened to paths Rust cannot resolve; nested `appSettings` becomes `[object Object]`; repeated siblings always resolve to the first one in Rust. | `src/parsers.ts:109-121`, `:147-154`, `parser-wasm/src/xml_parser.rs:69-108` |
| D7 | High | Verified | Raw editor mounts the validation overlay **inside** the contenteditable root and saves its `innerText`, so error marker text can be written into the file. Raw save also converts CRLF to LF and autosaves invalid content. | `src/ui/raw-editor.ts:38`, `:58`, `src/ui/raw-error-overlay.ts:30-33`, `src/controllers/file-editor-controller.ts:605` |
| D8 | High | Verified | ENV: original quote style is dropped; escaped quotes truncate the span; a value containing quotes corrupts on the second edit; `#` inside an unquoted URL is treated as a comment; `export KEY=` is parsed by TS as key `export KEY`; TS includes inline comments in the value while Rust excludes them. | `parser-wasm/src/lib.rs:105-111`, `parser-wasm/src/env_parser.rs:165-167`, `:179-181`, `src/parsers.ts:258-283` |
| D9 | Medium | Verified | UTF-8 BOM: JSON is rejected outright; ENV validates but the first key is unfindable. | `parser-wasm/src/json_lexer.rs:50-141`, `parser-wasm/src/env_parser.rs:129-135` |
| D10 | Medium | Verified | XML: empty elements, self-closing elements and CDATA cannot be edited; namespaced tags never match (TS sends `x:a`, Rust compares local name `a`); a path to a parent element replaces its leading whitespace text. | `parser-wasm/src/xml_parser.rs:71-77`, `:104-108` |
| D11 | Medium | Verified | Mismatched close tags (`<r><a></b></r>`) pass Rust validation; `xmlparser` does not check nesting and `validate_syntax` only counts depth. | `parser-wasm/src/xml_parser.rs:42-61`, `parser-wasm/src/lib.rs:178-225` |
| D12 | Medium | Verified | JSON `validate_syntax` is lenient (`{"a": 1 "b": 2}` passes), so `update_value` will happily edit and write back invalid JSON while the raw editor (serde) reports it invalid. | `parser-wasm/src/json_lexer.rs:150-206` |
| D13 | Low | Verified | JSON numbers above 2^53 display rounded; `1.50` displays as `1.5`; `port: 0` renders as an empty input. | `src/ui/dom-renderer.ts:136`, `:159` |
| D14 | Low | Verified | `.env.local`, `.env.production`, `.properties`, `.ini` are detected as JSON. | `src/utils/fileTypeUtils.ts:16` |
| D15 | Low | Verified | Whitespace-padded XML text (`<a>  v  </a>`) loses its padding; `'` is rewritten as `&apos;` and `>` as `&gt;` even where not required. | `parser-wasm/src/lib.rs:510-521` |
| D16 | Low | Verified | JSON keys containing escape sequences (`"a\"b"`) never match because the raw key slice is compared unescaped. | `parser-wasm/src/json_parser.rs:134-138` |

### 2.1 Details and reproductions

**D1 — dotted keys.** `appsettings.json` with `"Logging": { "LogLevel": { "Microsoft.AspNetCore": "Warning" } }`. The form field is named `Logging.LogLevel.Microsoft.AspNetCore`; persistence splits it into `["Logging","LogLevel","Microsoft","AspNetCore"]`. Two consequences:

- Rust returns `Path not found`, the exception aborts `saveFile`, and nothing is written.
- An **untouched** form already emits an update for this key, because `getNestedValue` with the split path returns `undefined` and `hasValueChanged("", "Warning")` is true. So the first edit *anywhere* in the file fails.

The same applies to `<system.web>` in `web.config` and to properties-style ENV keys such as `database.host=` (which `looksLikeEnvFormat` at `src/utils/fileTypeUtils.ts:69-70` explicitly accepts). Rust ENV then rejects with `ENV path must contain exactly one key`.

jsdom probe output:

```
JSON untouched form ->
  update_value(json, path=["Microsoft","AspNetCore"], value="Warning")
WEB.CONFIG after unchecking debug ->
  update_value(xml, path=["configuration","system","web","compilation","@debug"], value="false")
```

**D2 — arrays.** `"list": [1, 2]`, edit the first item to `5`:

```
update_value(json, path=["list"], value="[\"5\",\"2\"]")
```

Numbers become strings, and a multi-line array collapses to one line (Rust `is_json_literal` accepts the array text and splices it as-is). For repeated XML elements `<origins><o>a</o><o>b</o></origins>`, clicking "+ Add Item" produced:

```
update_value(xml, path=["c","origins","o"], value="[\"[object Object]\",\"[object Object]\",\"\"]")
```

which Rust writes, escaped, into the first `<o>` element's text.

Note also that the `.array-field` container has `name` set to the path (`dom-renderer.ts:226`) but its item inputs have no `name`, so `FormData` never sees them; the only path is the custom `.array-field` branch.

**D3 — Rust array index.** Native run against `{"servers":[{"host":"a","port":1},{"host":"b","port":2}]}`:

```
OK   servers/0/host: "\"a\""
ERR  servers/0/port: Path not found
ERR  servers/1/host: Path not found
OK   servers/1/port: "1"      <-- this is servers[0].port
```

The `Comma` arm increments `arr_idx_stack` whenever the innermost *array* is on that stack, but objects never push onto that stack, so a comma between object members is counted as an array separator. Arrays of primitives and nested arrays work; arrays of objects with more than one member do not.

**D4 — display coercion.** `<x><phone>0401234567</phone><ver>1.10</ver><zip>02100</zip></x>` parses to `401234567`, `1.1`, `2100`. ENV `VER=1.10` shows `1.1`; re-typing `1.10` produced no update call because `convertFormValueToString` normalises it back to `"1.1"`, which equals the coerced original. The user can never write `1.10`.

**D5 — write-side retyping.**

```
{"version": "1.0"}  edit to 2     -> {"version": 2}
{"flag": "yes"}     edit to true  -> {"flag": true}
{"s": "x"}          edit to [1,2] -> {"s": [1,2]}
{"s": "x"}          edit to 007   -> {"s": "007"}   (inconsistent: not a valid JSON number)
```

**D6 — .NET configs.** `<appSettings><add key="A" value="1"/><add key="B" value="2"/></appSettings>` at the root renders inputs named `A` and `B`; editing `B` sends path `["B"]`, which Rust cannot resolve (`Path not found: B`). The canonical `<configuration><appSettings>…` layout renders two `[object Object]` inputs instead. Rust has no index syntax for siblings, so `appSettings/add/@value` always hits the first `add`.

**D7 — raw editor.** `RawEditor.mount()` calls `RawErrorOverlay.mount(this.root)`, which appends the overlay as a child of the contenteditable root. `getContent()` iterates `root.children`, so even with no errors it emits one extra trailing newline; with an error marker shown it emits the marker text as a line. `handleRawSave` reads `innerText` of the same root; the overlay is `position:absolute; pointer-events:none` (`styles/components.css:336-341`), not `display:none`, so browsers include its text. jsdom result:

```
RAW getContent (CRLF input):            "{\n  \"a\": 1\n}\n\n"
RAW getContent with error overlay shown: "{\n  \"a\": 1\n}\n\nLine 1Boom here"
```

Validation runs 400 ms after input and raw autosave 600 ms after input, so the marker is routinely visible at save time. `saveRaw` writes to disk regardless of validity.

**D8 — ENV round trips.** Native run:

```
API_KEY="abc"      edit to xyz   -> API_KEY=xyz          (quotes dropped)
K='abc'            edit to xyz   -> K=xyz
K="a \" b"         span          -> "a \"                (stops at escaped quote)
URL=http://x/#frag span          -> http://x/            ('#' treated as comment)
K=v                edit to a "q" -> K="a \"q\""
   then edit to z                -> K=zq\""              (corrupted)
A=1 / A=2          validate      -> duplicate key 'A'    (whole file unusable)
K="l1<newline>l2"  validate      -> unterminated quoted value
```

TS side: `KEY=value # comment` parses to `"value # comment"`, so an edit to `value2 # comment` is quoted and written after the real comment: `KEY="value2 # comment" # comment`. `export K2=v` parses to key `export K2`, which Rust cannot find.

---

## 3. Structure, DRY and SOLID

The root cause of most of section 2 is **two independent grammars per format**. `src/parsers.ts` parses for display; `parser-wasm/` parses for writing. They disagree on quoting, comments, coercion, key/value flattening and path shape. The durable fix is to have Rust produce the tree once, with byte spans and original token types, and have the UI render that model.

| ID | Finding | Where |
| --- | --- | --- |
| S1 | Schema validation never runs. The controller destructures `validateWithId`, `validateInline`, `registerSchema`; the WASM exports are `validate_schema_with_id`, `validate_schema`, `register_schema`. All three are `undefined`, so `runSchemaValidation` returns `null`. `docs/validation.md` documents the feature as live. | `src/controllers/file-editor-controller.ts:367-381`, `parser-wasm/pkg/parser_core.d.ts:3-8` |
| S2 | The WASM API is declared three times: `parser-wasm/pkg/parser_core.d.ts`, `src/types/parser_core.d.ts`, and inline `as unknown as {…}` casts in the controller. This is how S1 drifted. | `src/types/parser_core.d.ts`, `src/controllers/file-editor-controller.ts:223-248`, `:367-380` |
| S3 | ENV "missing `=`" detection exists three times: Rust, controller augmentation, controller provisional scan. Errors are reported twice. | `src/controllers/file-editor-controller.ts:82-126`, `:295-321`, `parser-wasm/src/env_parser.rs:139-145` |
| S4 | `.config` content sniffing exists twice with different logic (`startsWith` vs `JSON.parse`). | `src/utils/fileTypeUtils.ts:19-40`, `src/handleStorage.ts:132-143` |
| S5 | Dead code from the pre-WASM design: `IParser.serialize`, `XmlParser.serialize` (DOM mutate + `XMLSerializer`), `fallbackSerialize`, `objectToXml`, `EnvParser.serialize`, `ParserFactory.registerParser`. | `src/parsers.ts:76-100`, `:170-243`, `:293-318`, `:364-366` |
| S6 | Dead UI code: the `textarea[data-type="array"]` branch; `setupArrayEventListeners` reads `data-index` while the renderer writes `data-idx`; a "Save" click handler keyed on `textContent.includes("Save")` for buttons that no longer exist; deprecated `onFileRefresh`/`onFieldChange`/`onArrayItem*` handlers; `removeAllEventListeners`, `getFieldValueFromElement`, `setFieldValueInElement`. | `src/persistence.ts:218-246`, `src/ui/event-handlers.ts:210-237`, `:301-380`, `src/main.ts:203-207` |
| S7 | `main.ts` is an 850-line orchestrator holding file state, dialogs, storage, group colours and save scheduling. `loadPersistedFiles` dedupes by file **name**, so same-named files in different groups collide on reload (code-read). | `src/main.ts:635-640` |
| S8 | `form-utils.ts` polls the DOM with `setTimeout` retries and `console.log` noise instead of the renderer returning the form it created. | `src/ui/form-utils.ts` |
| S9 | `saveRaw` classifies errors by substring-matching messages (`startsWith("invalid json format")`). | `src/persistence.ts:77-84` |
| S10 | Mixed tab / 8-space indentation within single files; `exactOptionalPropertyTypes` is enabled but worked around with `(fd as any).x = …` and `as unknown as` casts; ESLint is referenced (`tsconfig.eslint.json`, CI comment) but not configured. | throughout |
| S11 | Repo hygiene: `build-tools/*.js` and `*.cjs` both tracked; three Dockerfiles, nginx config, docker-compose and `deploy.sh` for an offline tool; `dev-tools/validate-*.sh` scripts; `parser-wasm/package.json` pins `wasm-pack ^0.12.1` while root pins `^0.13.1`. | repo root |

---

## 4. Rust usage

The crate is sound but not idiomatic, and no quality gate is applied: `cargo clippy` reports 33 warnings and **CI never runs `cargo test`** (`.github/workflows/ci.yml` only builds WASM).

| ID | Finding | Where |
| --- | --- | --- |
| R1 | `BytePreservingParser` is defined in `env_parser.rs` but shared by all parsers; it is imported at the *bottom* of `lib.rs` under a comment saying it should be at the top. `XmlParser::replace_value` re-implements the trait default verbatim. | `parser-wasm/src/env_parser.rs:8-21`, `lib.rs:541-542`, `xml_parser.rs:125-131` |
| R2 | Line/column math is implemented three times with inconsistent byte-vs-char columns (`LineIndex::line_col` is byte-based; the other two are char-based). `compute_offset_from_line_col` is a nested-loop walk that should be a `LineIndex` lookup. | `lib.rs:428-481`, `multi_validation.rs:621-651`, `env_parser.rs:364-379` |
| R3 | ~250 lines of `Reflect::set` boilerplate build JS result objects by hand. `serde-wasm-bindgen` on `#[derive(Serialize)]` structs removes all of it and lets `wasm-bindgen`/`tsify` generate the `.d.ts`, fixing S2. | `lib.rs:125-426`, `schema.rs:319-391` |
| R4 | `env_parser` computes `lead_ws` and then recomputes the same offset with raw pointer subtraction. `Entry` captures `_quote` and `_key_span` but never uses them; `quote` is exactly the information needed to preserve quote style (D8). | `env_parser.rs:110-113`, `:189-202`, `:258-263` |
| R5 | `update_value` lexes the document twice (validate, then find). `path` elements that are not strings silently become `""` via `unwrap_or_default`. | `lib.rs:51-60`, `:66-74` |
| R6 | XML multi-error collection re-tokenises from the middle of the document, so every error after the first is likely spurious; error codes are classified by substring-matching the error message. | `multi_validation.rs:172-218`, `:249-259` |
| R7 | `wee_alloc` is archived and has a known leak; the default allocator is fine at this size. `smallstr` and `web-sys` are declared but unused. `once_cell` can be `std::sync::LazyLock`; the `Mutex` around the schema cache is unnecessary in single-threaded WASM. `jsonschema 0.17` is dated. `wasm-opt = false` leaves binary size on the table. | `parser-wasm/Cargo.toml` |
| R8 | Clippy: redundant `usize` casts (14), `iter().any()` where `contains()` works, loop indices used only to index, no `Default` impls, `Span::len` without `is_empty`, a very large `Err` variant. | `cargo clippy --all-targets` |
| R9 | Test-only `println!` left in the production lexer under `#[cfg(test)]`; Finnish doc comments mixed with English. | `json_lexer.rs:94-98`, `:1-4` |

---

## 5. Security

Offline scope limits impact, but these are real and cheap to fix.

| ID | Severity | Status | Finding | Where |
| --- | --- | --- | --- | --- |
| X1 | Medium | Verified | HTML injection from untrusted content. The filename is inserted with `innerHTML` in the conflict dialog and reconnect card; a file named `<img src=x onerror=…>.json` executed in the probe. Object and array **keys** are inserted with `innerHTML` in the field headers. The page holds writable file handles for every granted file, so script execution can read and overwrite them. Use `textContent`. | `src/confirmation.ts:206`, `src/ui/notifications.ts:572-575`, `src/ui/dom-renderer.ts:199`, `:234` |
| X2 | Low | Code-read | IndexedDB stores full file contents, including `.env` secrets, unencrypted in the browser profile. The README should say so. | `src/handleStorage.ts:94` |
| X3 | Low | Code-read | CSS selectors are built from filenames (`[data-reconnect-file="${file.name}"]`); a `"` in a name throws. | `src/permissionManager.ts:156`, `:246` |
| X4 | Low | Code-read | CI installs wasm-pack via `curl … | sh` and uses the archived `actions-rs/toolchain@v1`; `codecov-action@v3` is outdated. | `.github/workflows/ci.yml` |

---

## 6. Tests and tooling

- `jest.config.cjs:9-13` ignores `dom-renderer.test.ts`, `modern-form-renderer.test.ts` and `file-conflict-detection.test.ts` outright.
- `jest.config.cjs:30-31` maps every import of `persistence` to `tests/__mocks__/persistence.js`, so `tests/unit/persistence.test.ts` tests the mock. `extractFieldChanges`, `convertFormValueToString` and `hasArrayChanged` have no coverage.
- `tests/setup.ts:19-36` mocks the WASM module globally. No test exercises a real parse → edit → write round trip.
- Rust tests cover only primitive arrays, unique XML elements and simple ENV lines. None cover arrays of objects, repeated elements, empty elements, BOM, CRLF or quote preservation.
- `cargo test` and `cargo clippy` are not in CI. The README claims Rust tests run via `npm test` inside `parser-wasm/`; nothing invokes that.

Recommendation: a golden-file suite in Rust (input file, edit, expected output compared byte-for-byte) run via `cargo test` in CI, plus one Jest integration test that loads the real `wasm-pack` output.

---

## 7. Recommended order of work

1. **Path encoding.** Replace `split(".")` with an array path carried end to end (JSON Pointer or `string[]` on the DOM element). Fixes D1 and the `system.web` / properties cases.
2. **Arrays.** Address elements by index in Rust (fix the `Comma` arm in `json_parser.rs` by tracking object vs array contexts on one stack) and add index syntax for repeated XML siblings. Stop re-serialising arrays in `persistence.ts`. Fixes D2, D3, D6.
3. **Types and quoting.** Return the original token kind and quote style from Rust to the UI and pass them back on write; stop coercing in `parsers.ts`; make `is_json_literal` respect the original type. Fixes D4, D5, D8.
4. **Raw editor.** Mount the overlay as a sibling of the contenteditable root; read content from `.raw-line` elements only; preserve the original line ending; do not autosave invalid raw content. Fixes D7.
5. **Single parse model.** Expose a Rust `parse_tree(file_type, content)` that returns the tree with spans and types; delete the TS parsers' serialize paths and the duplicated sniffing/validation. Fixes S1 through S6 structurally.
6. **Quality gates.** Add `cargo test` and `cargo clippy -- -D warnings` to CI, un-ignore the skipped Jest files, remove the persistence mock, add round-trip tests. Replace `innerHTML` with `textContent` (X1).
