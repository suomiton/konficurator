/**
 * File Type Utilities
 * Centralized file type detection and handling logic
 * Follows DRY principle to avoid duplication
 */

export type SupportedFileType = "json" | "xml" | "config" | "env";

/**
 * Determines file type based on extension and content
 */
export function determineFileType(
	filename: string,
	content?: string
): SupportedFileType {
	const extension = filename.toLowerCase().split(".").pop();

	// Handle .config files specially - detect format based on content when available
	if (extension === "config") {
		if (content) {
			const trimmedContent = content.trim();
			
			// Try to detect JSON content
			if (trimmedContent.startsWith("{") || trimmedContent.startsWith("[")) {
				try {
					JSON.parse(trimmedContent);
					return "json"; // It's JSON content in a .config file
				} catch {
					// Not valid JSON, continue with other checks
				}
			}

			// Try to detect XML content
			if (
				trimmedContent.startsWith("<?xml") ||
				trimmedContent.startsWith("<")
			) {
				return "xml"; // It's XML content in a .config file
			}

			// Check if it's ENV format (key=value pairs)
			if (looksLikeEnvFormat(trimmedContent)) {
				return "env";
			}
		}

		// Default to config format for .config files
		return "config";
	}

	// Standard extension-based detection
	switch (extension) {
		case "xml":
			return "xml";
		case "env":
			return "env";
		case "json":
		default:
			return "json";
	}
}

/**
 * Checks if content looks like ENV format (key=value pairs)
 */
function looksLikeEnvFormat(content: string): boolean {
	const lines = content.split("\n").filter(line => line.trim() && !line.trim().startsWith("#"));
	if (lines.length === 0) return false;
	
	// Check if most lines follow key=value pattern
	// Allow mixed case, underscores, dots (for properties files), and flexible naming
	const envLikeLines = lines.filter(line => /^[a-zA-Z_][a-zA-Z0-9_.]*\s*=/.test(line.trim()));
	return envLikeLines.length > lines.length * 0.5; // At least 50% of lines should look like ENV
}

/**
 * Gets file type display name
 */
export function getFileTypeDisplayName(fileType: SupportedFileType): string {
	return fileType.toUpperCase();
}

/**
 * Gets MIME type for file type
 */
export function getMimeTypeForFileType(fileType: SupportedFileType): string {
	switch (fileType) {
		case "json":
			return "application/json";
		case "xml":
		case "config":
			return "application/xml";
		case "env":
			return "text/plain";
		default:
			return "application/json";
	}
}

/**
 * Gets file extensions for file type
 */
export function getExtensionsForFileType(fileType: SupportedFileType): string[] {
	switch (fileType) {
		case "json":
			return [".json"];
		case "xml":
			return [".xml"];
		case "config":
			return [".config"];
		case "env":
			return [".env"];
		default:
			return [".json"];
	}
}
