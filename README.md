# 🔧 Konficurator

A lightweight, browser-only configuration file manager for JSON and XML files. Built with vanilla TypeScript and modern web APIs.

## Features

- **📁 Multi-file Support**: Select and edit multiple JSON/XML files simultaneously
- **🔄 Smart Form Generation**: Automatically generates appropriate form inputs based on data types
- **💾 Explicit Saving**: Changes only persist when you explicitly save
- **🌐 Browser-only**: No backend required - uses File System Access API
- **📱 Responsive Design**: Works on desktop and mobile browsers
- **🎯 Type-safe**: Built with TypeScript for better reliability

## Quick Start

1. **Serve the application**:

   ```bash
   npm run serve
   ```

   Or simply open `index.html` in a modern browser that supports the File System Access API.

2. **Select files**: Click "Select Configuration Files" and choose your JSON/XML files

3. **Edit values**: Modify values in the generated forms

4. **Save changes**: Click the "Save Changes" button for each file you want to update

## Browser Support

Requires browsers with File System Access API support:

- Chrome 86+
- Edge 86+
- Opera 72+

## Architecture

The application follows SOLID principles with clear separation of concerns:

### Core Modules

- **FileHandler** (`src/fileHandler.ts`): Manages file operations using File System Access API
- **Parsers** (`src/parsers.ts`): JSON and XML parsing with extensible parser factory
- **Renderer** (`src/renderer.ts`): Dynamic form generation based on data structure
- **Persistence** (`src/persistence.ts`): Handles saving form data back to files
- **Main** (`src/main.ts`): Application orchestration and event handling

### Design Principles Applied

- **Single Responsibility**: Each module has one clear purpose
- **Open/Closed**: Easy to add new file types or input types
- **Liskov Substitution**: Parsers implement common interfaces
- **Interface Segregation**: Small, focused interfaces
- **Dependency Inversion**: High-level modules depend on abstractions

## Form Field Types

The application automatically determines input types:

- **String values** → Text inputs
- **Number values** → Number inputs
- **Boolean values** → Checkboxes
- **Objects** → Nested form sections
- **Arrays** → JSON text areas (editable as JSON)

## Development

### Setup

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Watch for changes during development
npm run watch

# Serve locally
npm run serve

# Development mode (watch + serve)
npm run dev
```

### Project Structure

```
konficurator/
├── index.html              # Main HTML file
├── styles/
│   └── main.css            # Application styles
├── src/
│   ├── interfaces.ts       # TypeScript interfaces
│   ├── fileHandler.ts      # File operations
│   ├── parsers.ts          # JSON/XML parsing
│   ├── renderer.ts         # Form generation
│   ├── persistence.ts      # Save operations
│   └── main.ts            # Main application
├── samples/               # Sample config files
├── dist/                  # Compiled JavaScript (generated)
├── package.json
├── tsconfig.json
└── README.md
```

## Usage Examples

### JSON Configuration

```json
{
	"app": {
		"name": "My App",
		"port": 3000,
		"debug": true
	},
	"features": ["auth", "cache"]
}
```

### XML Configuration

```xml
<?xml version="1.0" encoding="UTF-8"?>
<config>
  <server>
    <host>localhost</host>
    <port>8080</port>
    <ssl>false</ssl>
  </server>
</config>
```

## Extending the Application

### Adding New File Types

1. **Create a new parser**:

```typescript
export class YamlParser extends BaseParser {
	parse(content: string): ParsedData {
		// YAML parsing logic
	}

	serialize(data: ParsedData): string {
		// YAML serialization logic
	}

	getFileType(): string {
		return "yaml";
	}
}
```

2. **Register the parser**:

```typescript
ParserFactory.registerParser("yaml", () => new YamlParser());
```

### Adding New Input Types

Extend the `FormRenderer` class to handle new data types:

```typescript
private createCustomField(key: string, value: any, path: string): HTMLElement {
  // Custom input field logic
}
```

## Sample Files

The `samples/` directory contains example configuration files:

- `app-config.json` - Application configuration example
- `server-config.xml` - Server configuration example

## Security Notes

- Files are processed entirely client-side
- No data is sent to external servers
- File System Access API requires user permission for each file
- Changes only persist when explicitly saved

## Contributing

1. Fork the repository
2. Create a feature branch
3. Follow the existing code style and architecture patterns
4. Add tests for new functionality
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

---

**Note**: This application requires modern browser support for the File System Access API. For older browsers, consider using the File API with manual file upload/download as a fallback.
