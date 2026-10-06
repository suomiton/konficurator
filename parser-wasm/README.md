# Parser WASM

Rust is the source of truth for displaying and editing JSON, XML, ENV, properties and INI configuration files. The returned tree includes exact value strings, token kinds, array paths, quote styles and UTF-8 byte spans. Saving changes only the selected value span.

See [parser responsibilities](../docs/rust-parser.md) for formats, path conventions and the full API.

From the repository root:

```bash
npm ci
npm run build:wasm       # browser bindings and generated declarations
npm run build:wasm:test  # Node bindings for real integration tests
npm run test:rust        # native regression tests
npm run lint:rust        # Clippy, with warnings denied
npm test                # JSDOM UI/persistence round trips with real WASM
```

Rust must have the `wasm32-unknown-unknown` target installed. The root package provides the sole wasm-pack dependency. Release builds use the default allocator, link-time optimization and wasm-opt.

```js
import init, { parse_tree, update_value } from './pkg/parser_core.js';
await init();
const source = '{"servers":[{"port":1},{"port":2}],"version":"1.0"}';
const tree = parse_tree('json', source);
const edited = update_value('json', source, ['servers', '1', 'port'], '5');
// Only the second port token changes. Editing version to "2" keeps it a string.
```

Invalid syntax, missing paths, non-string path segments and JSON type changes throw before a file is written. XML schemas and external DTD entity expansion are not supported.
