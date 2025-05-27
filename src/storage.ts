import { FileData } from "./interfaces.js";

/**
 * Storage Service for persisting file data across browser sessions
 * Uses localStorage and File System Access API handle serialization
 */
export interface StoredFileData {
	name: string;
	type: "json" | "xml" | "config";
	lastModified: number;
	serializedHandle?: any; // For File System Access API handles
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
			const storedFiles: StoredFileData[] = files.map((file) => ({
				name: file.name,
				type: file.type,
				lastModified: Date.now(),
				serializedHandle: this.serializeHandle(file.handle),
			}));

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
			const fileDataPromises = storedFiles.map(
				async (stored): Promise<FileData | null> => {
					try {
						const handle = await this.deserializeHandle(
							stored.serializedHandle
						);
						if (!handle) {
							return null;
						}

						// Verify file still exists and we have permission
						const file = await handle.getFile();
						const content = await file.text();

						return {
							name: stored.name,
							handle,
							type: stored.type,
							content,
						};
					} catch (error) {
						console.warn(`Failed to restore file ${stored.name}:`, error);
						return null;
					}
				}
			);

			const results = await Promise.all(fileDataPromises);
			return results.filter((file): file is FileData => file !== null);
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
	 * Serialize FileSystemFileHandle for storage
	 * Note: This is experimental and may not work in all browsers
	 */
	private static serializeHandle(handle: FileSystemFileHandle): any {
		try {
			// For now, we can only store metadata
			// Full handle serialization is limited by browser security
			return {
				name: handle.name,
				kind: handle.kind,
			};
		} catch (error) {
			console.warn("Failed to serialize file handle:", error);
			return null;
		}
	}

	/**
	 * Deserialize FileSystemFileHandle from storage
	 * Note: This is experimental and may require user permission again
	 */
	private static async deserializeHandle(
		serializedHandle: any
	): Promise<FileSystemFileHandle | null> {
		try {
			if (!serializedHandle) {
				return null;
			}

			// Due to browser security limitations, we cannot fully restore handles
			// The user will need to reselect files after browser restart
			// This is a placeholder for future browser capabilities
			return null;
		} catch (error) {
			console.warn("Failed to deserialize file handle:", error);
			return null;
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
