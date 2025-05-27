# 🔧 Konficurator

[![Deploy to GitHub Pages](https://github.com/suomiton/konficurator/actions/workflows/deploy.yml/badge.svg)](https://github.com/suomiton/konficurator/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![File System Access API](https://img.shields.io/badge/File%20System%20Access%20API-✓-green.svg)](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API)

🌐 **[Live Demo](https://suomiton.github.io/konficurator/)** | 📚 **[Documentation](https://github.com/suomiton/konficurator/blob/main/README.md)** | 🐛 **[Issues](https://github.com/suomiton/konficurator/issues)**

A lightweight, browser-only configuration file manager for JSON and XML files. Built with vanilla TypeScript and modern web APIs.

## Features

- **📁 Multi-file Support**: Select and edit multiple JSON/XML files simultaneously
- **🔄 Smart Form Generation**: Automatically generates appropriate form inputs based on data types
- **💾 Explicit Saving**: Changes only persist when you explicitly save
- **🌐 Browser-only**: No backend required - uses File System Access API
- **📱 Responsive Design**: Works on desktop and mobile browsers
- **🎯 Type-safe**: Built with TypeScript for better reliability

## Quick Start

### 🚀 Try it Online

**[Open Konficurator →](https://suomiton.github.io/konficurator/)**

### 🛠️ Local Development

1. **Clone and setup**:

   ```bash
   git clone https://github.com/suomiton/konficurator.git
   cd konficurator
   npm install
   ```

2. **Serve the application**:

   ```bash
   npm run serve
   ```

   Or simply open `index.html` in a modern browser that supports the File System Access API.

3. **Select files**: Click "Select Configuration Files" and choose your JSON/XML files

4. **Edit values**: Modify values in the generated forms

5. **Save changes**: Click the "Save Changes" button for each file you want to update

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

We welcome contributions! Here's how to get started:

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/your-username/konficurator.git
   ```
3. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```
4. **Follow the existing patterns**:
   - Use TypeScript for type safety
   - Follow SOLID principles
   - Add comprehensive error handling
   - Update documentation as needed
5. **Test your changes** thoroughly
6. **Submit a pull request** with a clear description

### Development Guidelines

- Follow the existing code style and architecture patterns
- Add JSDoc comments for new public methods
- Ensure TypeScript compilation passes without errors
- Test with both JSON and XML files
- Verify responsiveness on different screen sizes

### Reporting Issues

Found a bug or have a feature request? [Open an issue](https://github.com/suomiton/konficurator/issues) with:
- Clear description of the problem or feature
- Steps to reproduce (for bugs)
- Browser and version information
- Sample configuration files (if applicable)

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with modern web standards and TypeScript
- Inspired by the need for simple, client-side configuration management
- Uses the File System Access API for seamless file operations

---

**⚠️ Browser Compatibility**: This application requires modern browser support for the File System Access API. For a compatibility matrix, see [MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API#browser_compatibility).

**🚀 [Try Konficurator Now](https://suomiton.github.io/konficurator/)** | **⭐ [Star on GitHub](https://github.com/suomiton/konficurator)**
