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
	async selectFiles(): Promise<FileData[]> {
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
							"application/json": [".json"],
							"application/xml": [".xml"],
							"text/xml": [".xml"],
						},
					},
				],
			});

			const fileDataPromises = fileHandles.map(
				async (handle): Promise<FileData> => {
					const content = await this.readFile(handle);
					const fileType = this.determineFileType(handle.name);

					return {
						name: handle.name,
						handle,
						type: fileType,
						content: content,
					};
				}
			);

			return Promise.all(fileDataPromises);
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
	private determineFileType(filename: string): "json" | "xml" {
		const extension = filename.toLowerCase().split(".").pop();
		return extension === "xml" ? "xml" : "json";
	}
}
