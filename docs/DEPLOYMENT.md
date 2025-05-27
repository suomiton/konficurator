# 🚀 Konficurator Deployment Guide

## Quick Start

### 1. Development Setup

```bash
# Clone or extract the project
cd konficurator

# Install dependencies
npm install

# Build the TypeScript
npm run build

# Start development server
npm run serve
```

### 2. Using the Development Script

```bash
# Make script executable (first time only)
chmod +x dev.sh

# Build and serve in one command
./dev.sh dev

# Or use individual commands
./dev.sh build    # Build only
./dev.sh serve    # Serve only
./dev.sh watch    # Watch TypeScript files
./dev.sh clean    # Clean build artifacts
./dev.sh test     # Build, serve, and open browser
```

## Browser Requirements

**Supported Browsers:**

- ✅ Chrome 86+
- ✅ Edge 86+
- ✅ Opera 72+

**Unsupported Browsers:**

- ❌ Firefox (File System Access API not yet supported)
- ❌ Safari (File System Access API not yet supported)

## Deployment Options

### Option 1: Static File Server

Simply copy all files to any static web server:

```bash
# Copy project files
cp -r konficurator/ /path/to/web/server/
```

Required files for deployment:

- `index.html`
- `styles/main.css`
- `dist/*.js` (compiled JavaScript)
- `dist/*.js.map` (source maps, optional)

### Option 2: GitHub Pages

1. Push to GitHub repository
2. Enable GitHub Pages in repository settings
3. Select source as `main` branch
4. Access via `https://username.github.io/repository-name`

### Option 3: Local Bookmarkable File

1. Build the project: `npm run build`
2. Open `index.html` directly in a supported browser
3. Bookmark the page for easy access

## Testing the Application

### 1. Start the Server

```bash
npm run serve
# or
./dev.sh dev
```

### 2. Open in Browser

Navigate to: `http://localhost:8080`

### 3. Test with Sample Files

Use the provided sample files in `samples/`:

- `app-config.json` - JSON configuration example
- `server-config.xml` - XML configuration example

### 4. Test Workflow

1. Click "📁 Select Configuration Files"
2. Choose sample files from `samples/` folder
3. Edit values in the generated forms
4. Click "💾 Save Changes" for each file
5. Verify changes are saved to the original files

## Project Structure for Deployment

```
konficurator/
├── index.html              # Main entry point
├── styles/
│   └── main.css            # Application styles
├── dist/                   # Compiled JavaScript (required)
│   ├── main.js
│   ├── fileHandler.js
│   ├── parsers.js
│   ├── renderer.js
│   ├── persistence.js
│   └── interfaces.js
├── samples/                # Test files (optional)
└── src/                    # Source TypeScript (not needed for deployment)
```

## Environment Considerations

### Local Development

- Uses Python's built-in HTTP server
- Serves on `http://localhost:8080`
- CORS restrictions may apply for file://

### Production

- Any static file server works
- HTTPS recommended for security
- Must serve with proper MIME types for JavaScript modules

## Security Notes

1. **Client-Side Only**: All processing happens in the browser
2. **No Data Transmission**: Files never leave the user's device
3. **User Permission**: File System Access API requires explicit user permission
4. **Local Files Only**: Cannot access files outside user selection

## Troubleshooting

### "File System Access API not supported"

- Use a supported browser (Chrome, Edge, Opera)
- Ensure you're using a recent version

### "TypeError: Failed to resolve module specifier"

- Ensure you've run `npm run build`
- Check that `dist/` folder contains compiled JavaScript files
- Verify you're serving via HTTP (not file://)

### Files not saving

- Check browser console for errors
- Ensure files are not read-only
- Verify file permissions on your system

### TypeScript compilation errors

```bash
# Clean and rebuild
npm run clean
npm run build
```

## Performance

- **Bundle Size**: ~50KB total (uncompressed)
- **Load Time**: < 1 second on local network
- **Memory Usage**: < 10MB for typical configuration files
- **File Size Limits**: Depends on browser memory (typically 100MB+)

## Browser Permissions

The application requires these permissions:

- **File System Access**: To read and write configuration files
- **Local Storage**: For bookmarking application state (future feature)

Users will see permission prompts when:

1. First selecting files
2. Saving changes to files

## Support

For issues or questions:

1. Check the browser console for error messages
2. Verify browser compatibility
3. Test with sample files first
4. Check file permissions on your system
