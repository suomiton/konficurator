import { FileData } from "./interfaces.js";

/**
 * Storage Service for persisting file data across browser sessions
 * Uses localStorage and File System Access API handle serialization
 */
export interface StoredFileData {
	name: string;
	type: "json" | "xml" | "config";
	lastModified: number;
	content: string; // Store the actual file content
	size: number; // Store file size for reference
	path?: string; // Store file path when available
}

export class StorageService {
	private static readonly STORAGE_KEY = "konficurator_files";
	private static readonly VERSION_KEY = "konficurator_version";
	private static readonly CURRENT_VERSION = "1.0.0";

	/**
	 * Save file list to localStorage
	 */
	static saveFiles(files: FileData[]): void {
		try {
			const storedFiles: StoredFileData[] = files.map((file) => {
				const stored: StoredFileData = {
					name: file.name,
					type: file.type,
					lastModified: file.lastModified || Date.now(),
					content: file.originalContent, // Store raw string content
					size: file.size || file.originalContent.length,
				};

				// Only include path if it exists
				if (file.path) {
					stored.path = file.path;
				}

				return stored;
			});

			localStorage.setItem(this.STORAGE_KEY, JSON.stringify(storedFiles));
			localStorage.setItem(this.VERSION_KEY, this.CURRENT_VERSION);
		} catch (error) {
			console.warn("Failed to save files to localStorage:", error);
		}
	}

	/**
	 * Load file list from localStorage
	 */
	static async loadFiles(): Promise<FileData[]> {
		try {
			// Check version compatibility
			const storedVersion = localStorage.getItem(this.VERSION_KEY);
			if (storedVersion !== this.CURRENT_VERSION) {
				this.clearAll();
				return [];
			}

			const storedData = localStorage.getItem(this.STORAGE_KEY);
			if (!storedData) {
				return [];
			}

			const storedFiles: StoredFileData[] = JSON.parse(storedData);

			// Create FileData objects from stored content
			// Note: These won't have file handles, so saving will require user action
			const restoredFiles: FileData[] = storedFiles.map((stored) => {
				const fileData: FileData = {
					name: stored.name,
					handle: null, // Will be null for restored files
					type: stored.type,
					content: stored.content, // Raw string content, will be parsed later
					originalContent: stored.content, // Keep original content for future saves
					lastModified: stored.lastModified,
					size: stored.size,
				};

				// Only include path if it exists
				if (stored.path) {
					fileData.path = stored.path;
				}

				return fileData;
			});

			return restoredFiles;
		} catch (error) {
			console.warn("Failed to load files from localStorage:", error);
			return [];
		}
	}

	/**
	 * Remove specific file from storage
	 */
	static removeFile(filename: string): void {
		try {
			const storedData = localStorage.getItem(this.STORAGE_KEY);
			if (!storedData) {
				return;
			}

			const storedFiles: StoredFileData[] = JSON.parse(storedData);
			const filteredFiles = storedFiles.filter(
				(file) => file.name !== filename
			);

			localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filteredFiles));
		} catch (error) {
			console.warn("Failed to remove file from localStorage:", error);
		}
	}

	/**
	 * Clear all stored files
	 */
	static clearAll(): void {
		try {
			localStorage.removeItem(this.STORAGE_KEY);
			localStorage.removeItem(this.VERSION_KEY);
		} catch (error) {
			console.warn("Failed to clear localStorage:", error);
		}
	}

	/**
	 * Get stored file count
	 */
	static getStoredFileCount(): number {
		try {
			const storedData = localStorage.getItem(this.STORAGE_KEY);
			if (!storedData) {
				return 0;
			}
			const storedFiles: StoredFileData[] = JSON.parse(storedData);
			return storedFiles.length;
		} catch (error) {
			return 0;
		}
	}

	/**
	 * Check if browser supports persistent storage
	 */
	static isStorageAvailable(): boolean {
		try {
			return typeof localStorage !== "undefined";
		} catch (error) {
			return false;
		}
	}
}
