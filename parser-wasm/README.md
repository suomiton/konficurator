# Parser WASM

A high-performance WebAssembly-based configuration file parser written in Rust. This library provides fast, memory-efficient parsing and editing capabilities for JSON, XML, and environment (`.env`) files directly in the browser.

## 🚀 Overview

The parser-wasm module is a core component of the Konficurator project that enables precise, byte-preserving parsing and editing of configuration files. Built with Rust and compiled to WebAssembly, it delivers near-native performance while maintaining the safety and reliability of Rust's type system.

## ✨ Features

- **Multi-format Support**: Parse and edit JSON, XML, and environment files
- **Byte-preserving**: Maintains original file formatting, comments, and whitespace
- **Path-based Access**: Navigate nested structures using intuitive path arrays
- **Memory Efficient**: Optimized for minimal memory footprint with `wee_alloc`
- **Zero-copy Operations**: Efficient span-based value location and replacement
- **Browser Ready**: Compiled to WebAssembly for seamless browser integration

## 🏗️ Architecture

### Core Components

#### 1. **Main Library (`lib.rs`)**
- Exports the main `update_value` function to JavaScript
- Coordinates between different parsers based on file type
- Handles value escaping and formatting for each format
- Provides unified error handling across all parsers

#### 2. **JSON Parser (`json_parser.rs` + `json_lexer.rs`)**
- Custom tokenizer for precise JSON parsing
- Supports nested objects and arrays
- Path-based navigation (e.g., `["app", "database", "port"]`)
- Handles all JSON value types: strings, numbers, booleans, null

#### 3. **XML Parser (`xml_parser.rs`)**
- Built on the `xmlparser` crate for robust XML parsing
- Supports both element text content and attributes
- XPath-like navigation with `@attribute` syntax
- Handles nested XML structures with validation

#### 4. **Environment Parser (`env_parser.rs`)**
- Pure Rust implementation for `.env` file parsing
- Supports quoted and unquoted values
- Preserves comments and formatting
- Handles escape sequences and special characters

### Key Concepts

#### **Span-based Editing**
The library uses `Span` structs to represent byte ranges in the original content:

```rust
pub struct Span {
    pub start: usize,
    pub end: usize,
}
```

This allows for precise, non-destructive editing that preserves the original file structure.

#### **BytePreservingParser Trait**
All parsers implement a common interface:

```rust
pub trait BytePreservingParser {
    fn validate_syntax(&self, content: &str) -> Result<(), String>;
    fn find_value_span(&self, content: &str, path: &[String]) -> Result<Span, String>;
    fn replace_value(&self, content: &str, span: Span, new_val: &str) -> String;
}
```

## 📦 Dependencies

### Rust Crates
- **`wasm-bindgen`** (0.2): JavaScript/WebAssembly interop
- **`js-sys`** (0.3): JavaScript API bindings
- **`web-sys`** (0.3): Web API bindings
- **`xmlparser`** (0.13): Fast XML parsing
- **`serde`** (1.0): Serialization framework
- **`serde_json`** (1.0): JSON serialization
- **`wee_alloc`** (0.4): Small footprint allocator for WASM
- **`memchr`** (2.7.5): Fast string searching
- **`smallstr`** (0.3.0): String optimization
- **`json-event-parser`** (0.2.2): Streaming JSON parser

### Build Tools
- **`wasm-pack`** (0.12.1): Rust-to-WebAssembly compiler and packager

## 🛠️ Building

### Prerequisites
- Rust (latest stable)
- `wasm-pack` installed globally

### Build Commands

```bash
# Build for web target
npm run build
# or directly with wasm-pack
wasm-pack build --target web --out-dir pkg

# Run tests
npm test
# or directly with cargo
cargo test
```

### Build Configuration

The project is optimized for production with aggressive optimizations:

```toml
[profile.release]
opt-level = "z"     # Optimize for size
lto = true          # Link-time optimization
panic = "abort"     # Smaller panic handling
```

## 🎯 Usage Examples

### JavaScript Integration

```javascript
import init, { update_value } from './pkg/parser_core.js';

// Initialize the WASM module
await init();

// Update a JSON value
const jsonContent = '{"app": {"name": "MyApp", "port": 3000}}';
const updatedJson = update_value(
    "json", 
    jsonContent, 
    ["app", "port"], 
    "8080"
);
// Result: '{"app": {"name": "MyApp", "port": 8080}}'

// Update XML attribute
const xmlContent = '<config host="localhost" port="3000"/>';
const updatedXml = update_value(
    "xml", 
    xmlContent, 
    ["config", "@port"], 
    "8080"
);
// Result: '<config host="localhost" port="8080"/>'

// Update environment variable
const envContent = 'DATABASE_URL=postgres://localhost/db\nDEBUG=true';
const updatedEnv = update_value(
    "env", 
    envContent, 
    ["DEBUG"], 
    "false"
);
// Result: 'DATABASE_URL=postgres://localhost/db\nDEBUG=false'
```

### Path Formats

#### JSON Paths
- Object keys: `["app", "database", "host"]`
- Array indices: `["users", "0", "name"]`

#### XML Paths
- Elements: `["config", "database", "host"]`
- Attributes: `["config", "@version"]`

#### Environment Paths
- Variable names: `["DATABASE_URL"]`

## 🧪 Testing

The library includes comprehensive tests for all supported formats:

```bash
cargo test
```

Test coverage includes:
- Basic value updates for all formats
- Nested structure navigation
- Edge cases (quotes, escaping, special characters)
- Error handling and validation
- Performance benchmarks

## 🔧 Performance Optimizations

### Memory Management
- **`wee_alloc`**: Reduces WASM binary size by ~75KB
- **Zero-copy parsing**: Operates on string slices without allocation
- **Minimal dependencies**: Only essential crates included

### Build Optimizations
- **Size optimization**: `opt-level = "z"` for smallest binary
- **Link-time optimization**: Aggressive dead code elimination
- **Panic handling**: Abort-on-panic reduces binary size

### Parser Optimizations
- **Custom tokenizers**: Hand-optimized for each format
- **Span-based editing**: Minimal memory allocation during updates
- **Lazy evaluation**: Parse only what's needed for the target path

## 🔄 Integration with Konficurator

This WASM parser integrates seamlessly with the main Konficurator application:

1. **File Loading**: Main app loads configuration files
2. **Format Detection**: Determines file type (JSON/XML/ENV)
3. **WASM Parsing**: Delegates parsing to this high-performance module
4. **UI Updates**: Results displayed in the web interface
5. **File Saving**: Modified content written back to files

## 🚦 Error Handling

The parser provides detailed error messages for:
- **Syntax errors**: Invalid JSON/XML/ENV syntax
- **Path errors**: Non-existent paths or invalid navigation
- **Type errors**: Incompatible value types
- **Format errors**: Malformed file structures

Errors are propagated as JavaScript exceptions with descriptive messages.

## 📈 Future Enhancements

- **YAML Support**: Add YAML parsing capabilities
- **TOML Support**: Support for TOML configuration files
- **Streaming Parser**: Handle large files with streaming
- **Validation**: Schema validation for configuration files
- **Source Maps**: Track original file positions through edits

## 🤝 Contributing

When contributing to the parser-wasm module:

1. **Run tests**: Ensure all tests pass before submitting
2. **Add tests**: Include tests for new functionality
3. **Optimize**: Consider performance and binary size impact
4. **Document**: Update this README for significant changes

## 📄 License

This project is licensed under the same terms as the main Konficurator project.
