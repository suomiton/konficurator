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
							"text/plain": [".config"],
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
	 * Determines file type based on extension
	 */
	private determineFileType(filename: string): "json" | "xml" | "config" {
		const extension = filename.toLowerCase().split(".").pop();
		if (extension === "xml") return "xml";
		if (extension === "config") return "config";
		return "json";
	}
}
