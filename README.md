# 🔧 Konficurator

[![CI](https://github.com/suomiton/konficurator/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/suomiton/konficurator/actions/workflows/ci.yml)
[![Deploy to GitHub Pages](https://github.com/suomiton/konficurator/actions/workflows/deploy.yml/badge.svg)](https://github.com/suomiton/konficurator/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![File System Access API](https://img.shields.io/badge/File%20System%20Access%20API-✓-green.svg)](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API)

🌐 **[Live Demo](https://suomiton.github.io/konficurator/)** | 📚 **[Documentation](https://github.com/suomiton/konficurator/blob/main/README.md)** | 🐛 **[Issues](https://github.com/suomiton/konficurator/issues)**

A lightweight, browser-only configuration file manager for JSON and XML files. Built with vanilla TypeScript and modern web APIs.

## 🎉 What's New (v2.0)

### ✨ **Major Enhancements**
- **📍 Enhanced File Display**: Real file paths with storage indicators 
- **📌 Sticky Save Buttons**: Always-accessible save functionality with smooth animations
- **🔄 Smart File Refresh**: Reload from disk with conflict detection and resolution
- **🛡️ Robust Error Handling**: Comprehensive notifications with recovery options
- **⚡ Production Optimization**: 73% size reduction with minification and compression
- **🐳 Docker Integration**: Multi-stage builds with nginx production serving
- **🧪 Comprehensive Testing**: Full test suite with CI/CD integration

### 🚀 **Performance Improvements**
- **JavaScript Uglification**: 50-60% size reduction with Terser
- **CSS Minification**: 25% optimization with CleanCSS  
- **HTML Compression**: 26% reduction with advanced minification
- **Gzip/Brotli Support**: Additional 40-77% compression
- **Pre-compressed Serving**: Automatic optimization for web servers

## ✨ Features

- **📁 Multi-file Support**: Select and edit multiple JSON/XML files simultaneously
- **🔄 Smart Form Generation**: Automatically generates appropriate form inputs based on data types  
- **📍 Enhanced File Display**: Shows actual file paths and storage indicators
- **📌 Sticky Save Buttons**: Always-accessible save functionality that appears when scrolling
- **💾 Intelligent Storage**: Persistent storage with automatic restoration and permission management
- **🔄 File Refresh**: Reload files from disk with conflict detection and resolution
- **🛡️ Robust Error Handling**: Comprehensive error notifications with recovery options
- **🌐 Browser-only**: No backend required - uses File System Access API
- **📱 Responsive Design**: Works on desktop and mobile browsers with touch-friendly interface
- **🎯 Type-safe**: Built with TypeScript for better reliability
- **⚡ Production Optimized**: 73% size reduction with minification and compression

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

- **FileHandler** (`src/fileHandler.ts`): Advanced file operations with File System Access API and permission management
- **Parsers** (`src/parsers.ts`): JSON and XML parsing with extensible parser factory
- **Renderer** (`src/renderer.ts`): Dynamic form generation with sticky save buttons and enhanced UI
- **Persistence** (`src/persistence.ts`): Intelligent file saving with conflict detection and resolution
- **Storage** (`src/handleStorage.ts`): Enhanced persistent storage with metadata and restoration capabilities
- **Permission Manager** (`src/permissionManager.ts`): Robust permission handling and validation
- **UI Components** (`src/ui/`): Reusable UI components and confirmation dialogs
- **Main** (`src/main.ts`): Application orchestration and enhanced event handling

### Design Principles Applied

- **Single Responsibility**: Each module has one clear purpose
- **Open/Closed**: Easy to add new file types or input types
- **Liskov Substitution**: Parsers implement common interfaces
- **Interface Segregation**: Small, focused interfaces
- **Dependency Inversion**: High-level modules depend on abstractions

## 🎯 Key Features in Detail

### 📍 Enhanced File Path Display
- Shows actual filesystem paths: `📁 samples/app-config.json`
- Storage indicators for restored files: `💾 config.json (from storage)`
- Smart fallbacks for different file sources
- Persistent across browser sessions

### 📌 Sticky Save Buttons  
- Appears automatically when scrolling past file tiles
- Glass morphism design with smooth animations
- Individual save buttons for each modified file
- Touch-friendly mobile interface
- Dynamic updates as files are saved

### 🔄 Intelligent File Refresh
- **Reload from Disk**: Refresh files while preserving unsaved changes
- **Conflict Detection**: Identifies when disk files have been modified
- **Smart Resolution**: Choose to keep changes, reload from disk, or merge
- **Permission Recovery**: Automatic permission restoration for saved files

### 🛡️ Robust Error Handling
- **Comprehensive Notifications**: Clear error messages with context
- **Recovery Options**: Actionable buttons to resolve issues
- **Permission Management**: Automatic re-permission flow for file access
- **Graceful Degradation**: Fallbacks when browser features are unavailable

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

# Development builds
npm run build          # Standard TypeScript compilation
npm run watch          # Watch for changes during development
npm run dev            # Development mode (build + serve)

# Production builds
npm run build:prod     # Complete optimized production build
npm run build:optimize # Minification and optimization only
npm run build:gzip     # Compression only (gzip + brotli)

# Serving
npm run serve          # Serve locally on port 8080
npm run clean          # Clean build directories
```

### Project Structure

```
konficurator/
├── index.html              # Main HTML file
├── styles/
│   └── main.css            # Application styles with enhanced UI
├── src/
│   ├── interfaces.ts       # TypeScript interfaces
│   ├── fileHandler.ts      # Advanced file operations
│   ├── parsers.ts          # JSON/XML parsing
│   ├── renderer.ts         # Enhanced form generation
│   ├── persistence.ts      # Intelligent save operations
│   ├── handleStorage.ts    # Enhanced storage management
│   ├── permissionManager.ts # Permission handling
│   ├── confirmation.ts     # User confirmation dialogs
│   ├── ui/                 # Reusable UI components
│   └── main.ts            # Main application orchestration
├── samples/               # Sample config files
├── manual-tests/          # Comprehensive test suite
├── docs/                  # Detailed documentation
├── dev-tools/             # Development utilities
├── build-tools/           # Production optimization scripts
├── dist/                  # Compiled JavaScript (generated)
├── build/                 # Optimized production build (generated)
├── coverage/              # Test coverage reports (generated)
├── deploy.sh              # One-command deployment script
├── docker-compose.yml     # Development and production containers
├── Dockerfile             # Multi-stage Docker build
├── package.json
├── tsconfig.json
└── README.md
```

## Production Deployment

### 🚀 Quick Deploy

For a production-ready build with optimization:

```bash
# One-command deployment
./deploy.sh
```

Or manually:

```bash
# Build optimized production version
npm run build:prod

# Copy build/ directory to your web server
```

### 📦 Docker Deployment

**Development**:

```bash
docker-compose up konficurator
```

**Production** (with optimization):

```bash
docker-compose --profile production up konficurator-prod
```

### ⚡ Performance Optimizations

The production build includes:

- **73% size reduction** through minification and compression
- **JavaScript uglification** with Terser (50-60% smaller files)
- **CSS minification** with CleanCSS (25% reduction)
- **HTML minification** (26% reduction)
- **Gzip compression** (additional 40-70% reduction)
- **Brotli compression** (additional 60-77% reduction)
- **Pre-compressed file serving** with nginx/Apache configuration
- **Optimized caching headers** for static assets

### 🌐 Server Configuration

The build process generates:

- `nginx-config.txt` - Ready-to-use nginx configuration
- `.htaccess` - Apache configuration for shared hosting
- Pre-compressed `.gz` and `.br` files for all assets

See [PRODUCTION_OPTIMIZATION.md](docs/PRODUCTION_OPTIMIZATION.md) for detailed optimization guide.

## 🧪 Testing & Quality Assurance

### Comprehensive Test Suite
- **Manual Tests**: Interactive testing pages in `manual-tests/`
- **Unit Tests**: Jest-based test suite with TypeScript support
- **Integration Tests**: End-to-end functionality validation
- **CI/CD Pipeline**: Automated testing with GitHub Actions
- **Coverage Reports**: Detailed code coverage analysis

### Test Categories
- **File Operations**: File loading, saving, and permission handling
- **Storage Management**: Persistence, restoration, and metadata handling  
- **UI Components**: Form generation, sticky behaviors, and responsiveness
- **Error Handling**: Error scenarios and recovery flows
- **Performance**: Build optimization and compression validation

### Development Testing
```bash
# Run test suite
npm test

# Watch mode for development
npm run test:watch  

# Coverage report
npm run test:coverage

# Manual testing pages
npm run serve
# Navigate to http://localhost:8080/manual-tests/
```

## 📊 CI/CD Pipeline

### Automated Workflows
- **Continuous Integration**: Tests, TypeScript compilation, and build verification
- **Build Verification**: Performance metrics and optimization validation
- **Docker Testing**: Container build and deployment verification  
- **Automated Deployment**: Optimized builds deployed to GitHub Pages

### Quality Gates
- **Test Coverage**: Maintains comprehensive test coverage
- **TypeScript Compilation**: Zero compilation errors required
- **Build Optimization**: Minimum 50% size reduction enforced
- **Performance Monitoring**: Build size and compression tracking

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

- `app-config.json` - Application configuration example with nested objects
- `server-config.xml` - Server configuration example with XML structure  
- `test-config.json` - Testing configuration with various data types
- `broken-config.json` - Example for testing error handling

## 📚 Documentation

Comprehensive documentation is available in the `docs/` directory:

- **[PRODUCTION_OPTIMIZATION.md](docs/PRODUCTION_OPTIMIZATION.md)** - Complete optimization guide
- **[ENHANCEMENT_SUMMARY.md](docs/ENHANCEMENT_SUMMARY.md)** - Feature implementation details
- **[CI_CD_PIPELINE_COMPLETE.md](docs/CI_CD_PIPELINE_COMPLETE.md)** - CI/CD setup and workflows
- **[PERMISSION_MANAGEMENT_COMPLETE.md](docs/PERMISSION_MANAGEMENT_COMPLETE.md)** - Permission system guide
- **[FILE_REFRESH_IMPLEMENTATION_COMPLETE.md](docs/FILE_REFRESH_IMPLEMENTATION_COMPLETE.md)** - File refresh functionality

## Security Notes

- **Client-side Processing**: Files are processed entirely client-side with no external data transmission
- **Permission-based Access**: File System Access API requires explicit user permission for each file
- **Secure Storage**: Browser-based storage with proper data isolation
- **Change Control**: Changes only persist when explicitly saved by the user
- **Error Boundaries**: Comprehensive error handling prevents application crashes
- **Input Validation**: Robust parsing with fallback mechanisms for malformed data

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

- **Architecture**: Follow SOLID principles and established patterns
- **Type Safety**: Use TypeScript with strict mode enabled
- **Error Handling**: Implement comprehensive error boundaries and user feedback
- **Testing**: Add unit tests for new functionality and integration tests for workflows
- **Documentation**: Update relevant docs in the `docs/` directory
- **Performance**: Maintain optimization targets and build efficiency
- **Accessibility**: Ensure responsive design and mobile compatibility
- **Security**: Follow client-side security best practices

### Code Quality Standards
- Follow the existing code style and architecture patterns
- Add JSDoc comments for new public methods and interfaces  
- Ensure TypeScript compilation passes without errors or warnings
- Test with both JSON and XML files of varying complexity
- Verify responsiveness on different screen sizes and devices
- Validate error handling scenarios and recovery flows

### Reporting Issues

Found a bug or have a feature request? [Open an issue](https://github.com/suomiton/konficurator/issues) with:

- **Clear Description**: Detailed explanation of the problem or requested feature
- **Reproduction Steps**: Step-by-step instructions to reproduce bugs
- **Environment Info**: Browser name, version, and operating system
- **Sample Files**: Configuration files that demonstrate the issue (if applicable)
- **Expected vs Actual**: What you expected to happen vs what actually occurred
- **Screenshots**: Visual evidence of UI issues or unexpected behavior

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Acknowledgments

- **Modern Web Standards**: Built with cutting-edge TypeScript and Web APIs
- **File System Access API**: Leveraging browser-native file operations for seamless UX
- **Community Driven**: Inspired by developer needs for simple, client-side configuration management
- **Performance Focused**: Enterprise-level optimization with 73% size reduction
- **Accessibility First**: Responsive design with comprehensive mobile support
- **Open Source**: MIT licensed for maximum flexibility and community contribution

## 🚀 Getting Started

Ready to manage your configuration files more efficiently?

1. **[Try the Live Demo](https://suomiton.github.io/konficurator/)** - No installation required
2. **[Star the Repository](https://github.com/suomiton/konficurator)** - Show your support  
3. **[Report Issues](https://github.com/suomiton/konficurator/issues)** - Help improve the project
4. **[Contribute](https://github.com/suomiton/konficurator/blob/main/README.md#contributing)** - Join the development

---

**⚠️ Browser Compatibility**: This application requires modern browser support for the File System Access API. For a compatibility matrix, see [MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API#browser_compatibility).

**🚀 [Try Konficurator Now](https://suomiton.github.io/konficurator/)** | **⭐ [Star on GitHub](https://github.com/suomiton/konficurator)**
