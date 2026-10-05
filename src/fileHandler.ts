import { IFileHandler, FileData } from "./interfaces";
import { GroupAccentId } from "./theme/groupColors";
import { determineFileType } from "./utils/fileTypeUtils";

// Lightweight UUID generator (fallback if crypto.randomUUID unavailable)
function generateId(): string {
	if (typeof crypto !== "undefined" && (crypto as any).randomUUID) {
		return (crypto as any).randomUUID();
	}
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0;
		const v = c === "x" ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}

/**
 * File Handling Module
 * Responsible for reading/writing files using the File System Access API
 * Follows Single Responsibility Principle
 */
export class FileHandler implements IFileHandler {
	/**
	 * Opens file picker and allows user to select multiple configuration files.
	 * Backward compatible signature: if first argument is an array, treat as existing files (group defaults to "default").
	 */
        async selectFiles(
                groupOrExisting: string | FileData[] = "default",
                existingFilesInGroup: FileData[] = [],
                groupColor?: GroupAccentId
        ): Promise<FileData[]> {
		try {
			// Check if File System Access API is supported
			if (!window.showOpenFilePicker) {
				throw new Error(
					"File System Access API is not supported in this browser"
				);
			}

			let group = "default";
			if (Array.isArray(groupOrExisting)) {
				// Old usage: first param was existing files
				existingFilesInGroup = groupOrExisting;
			} else {
				group = groupOrExisting;
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
					const fileType = determineFileType(handle.name, content);

					const fd: FileData = {
						id: generateId(),
						name: handle.name,
						handle,
						type: fileType,
						content: content, // Parsed later by app
						originalContent: content,
						group,
						path: file.webkitRelativePath || handle.name,
						lastModified: file.lastModified,
						size: file.size,
						isActive: true,
					} as FileData;
					if (groupColor) (fd as any).groupColor = groupColor;
					return fd;
				}
			);

			const newFiles = await Promise.all(fileDataPromises);

			// Filter out duplicates based on file name within the same group
			const uniqueNewFiles = newFiles.filter(
				(newFile) =>
					!existingFilesInGroup.some(
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
			const fileType = determineFileType(fileData.name, content);

			// Return updated file data with fresh content
			return {
				...fileData,
				type: fileType, // Update type based on current content
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
}
