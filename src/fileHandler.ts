import { IFileHandler, FileData } from "./interfaces.js";

/**
 * File Handling Module
 * Responsible for reading/writing files using the File System Access API
 * Follows Single Responsibility Principle
 */
export class FileHandler implements IFileHandler {
	/**
	 * Opens file picker and allows user to select multiple configuration files
	 */
	async selectFiles(existingFiles: FileData[] = []): Promise<FileData[]> {
		try {
			// Check if File System Access API is supported
			if (!window.showOpenFilePicker) {
				throw new Error(
					"File System Access API is not supported in this browser"
				);
			}

			const fileHandles = await window.showOpenFilePicker({
				multiple: true,
				types: [
					{
						description: "Configuration files",
						accept: {
							"application/json": [".json", ".config"],
							"application/xml": [".xml"],
							"text/xml": [".xml"],
							"text/plain": [".config", ".env"],
						},
					},
				],
			});

			const fileDataPromises = fileHandles.map(
				async (handle): Promise<FileData> => {
					const file = await handle.getFile();
					const content = await file.text();
					const fileType = this.determineFileType(handle.name);

					return {
						name: handle.name,
						handle,
						type: fileType,
						content: content, // Will be parsed later
						originalContent: content, // Keep raw string for storage
						path: file.webkitRelativePath || handle.name, // Use relative path if available, fallback to name
						lastModified: file.lastModified,
						size: file.size,
					};
				}
			);

			const newFiles = await Promise.all(fileDataPromises);

			// Filter out duplicates based on file name
			const uniqueNewFiles = newFiles.filter(
				(newFile) =>
					!existingFiles.some(
						(existingFile) => existingFile.name === newFile.name
					)
			);

			return uniqueNewFiles;
		} catch (error) {
			if (error instanceof Error && error.name === "AbortError") {
				// User cancelled file selection
				return [];
			}
			throw error;
		}
	}

	/**
	 * Reads content from a file handle
	 */
	async readFile(handle: FileSystemFileHandle): Promise<string> {
		const file = await handle.getFile();
		return await file.text();
	}

	/**
	 * Writes content to a file handle
	 */
	async writeFile(
		handle: FileSystemFileHandle,
		content: string
	): Promise<void> {
		const writable = await handle.createWritable();
		await writable.write(content);
		await writable.close();
	}

	/**
	 * Refreshes file content from disk using existing file handle
	 * @param fileData The file data with handle to refresh
	 * @returns Updated FileData with fresh content from disk
	 * @throws Error if file handle is invalid or file cannot be accessed
	 */
	async refreshFile(fileData: FileData): Promise<FileData> {
		if (!fileData.handle) {
			throw new Error(
				"Cannot refresh file: No file handle available. File was restored from storage."
			);
		}

		try {
			// Verify file handle is still valid by attempting to get file
			const file = await fileData.handle.getFile();
			const content = await file.text();

			// Return updated file data with fresh content
			return {
				...fileData,
				content: content, // Will be parsed later by the main app
				originalContent: content,
				lastModified: file.lastModified,
				size: file.size,
			};
		} catch (error) {
			if (error instanceof Error) {
				if (error.name === "NotAllowedError") {
					throw new Error(
						"Permission denied: Cannot access the file. You may need to grant permission again."
					);
				} else if (error.name === "NotFoundError") {
					throw new Error(
						"File not found: The file may have been moved, renamed, or deleted."
					);
				}
			}
			throw new Error(
				`Failed to refresh file: ${
					error instanceof Error ? error.message : "Unknown error"
				}`
			);
		}
	}

	/**
	 * Checks if the file on disk has been modified since it was loaded
	 * @param fileData The file data to check
	 * @returns Promise<boolean> - true if file on disk is newer
	 */
	async isFileModifiedOnDisk(fileData: FileData): Promise<boolean> {
		if (!fileData.handle || !fileData.lastModified) {
			return false; // Cannot check if no handle or no timestamp
		}

		try {
			const file = await fileData.handle.getFile();
			return file.lastModified > fileData.lastModified;
		} catch (error) {
			// If we can't read the file, assume it's not modified
			console.warn(
				`Cannot check modification status for ${fileData.name}:`,
				error
			);
			return false;
		}
	}

	/**
	 * Determines file type based on extension
	 */
	private determineFileType(
		filename: string
	): "json" | "xml" | "config" | "env" {
		const extension = filename.toLowerCase().split(".").pop();
		if (extension === "xml") return "xml";
		if (extension === "config") return "config";
		if (extension === "env") return "env";
		return "json";
	}
}
