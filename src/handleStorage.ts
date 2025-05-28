import { FileData } from "./interfaces.js";

/**
 * Enhanced Storage Service with File Handle Persistence
 * Uses IndexedDB to store file handles and automatic permission re-request
 */

export interface StoredFileHandle {
	name: string;
	handle: FileSystemFileHandle;
	lastModified: number;
	path?: string;
}

export interface StoredFileData {
	name: string;
	type: "json" | "xml" | "config";
	lastModified: number;
	content: string;
	size: number;
	path?: string;
}

export class EnhancedStorageService {
	private static readonly DB_NAME = "konficurator_db";
	private static readonly DB_VERSION = 1;
	private static readonly HANDLES_STORE = "file_handles";
	private static readonly DATA_STORE = "file_data";

	/**
	 * Initialize IndexedDB
	 */
	private static async initDB(): Promise<IDBDatabase> {
		return new Promise((resolve, reject) => {
			const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

			request.onerror = () => reject(request.error);
			request.onsuccess = () => resolve(request.result);

			request.onupgradeneeded = (event) => {
				const db = (event.target as IDBOpenDBRequest).result;

				// Create object stores
				if (!db.objectStoreNames.contains(this.HANDLES_STORE)) {
					db.createObjectStore(this.HANDLES_STORE, { keyPath: "name" });
				}

				if (!db.objectStoreNames.contains(this.DATA_STORE)) {
					db.createObjectStore(this.DATA_STORE, { keyPath: "name" });
				}
			};
		});
	}

	/**
	 * Save files with handle persistence
	 */
	static async saveFiles(files: FileData[]): Promise<void> {
		try {
			const db = await this.initDB();
			const transaction = db.transaction(
				[this.HANDLES_STORE, this.DATA_STORE],
				"readwrite"
			);
			const handlesStore = transaction.objectStore(this.HANDLES_STORE);
			const dataStore = transaction.objectStore(this.DATA_STORE);

			// Save file handles and data separately
			for (const file of files) {
				// Save file data
				const storedData: StoredFileData = {
					name: file.name,
					type: file.type,
					lastModified: file.lastModified || Date.now(),
					content: file.originalContent,
					size: file.size || file.originalContent.length,
				};

				if (file.path) {
					storedData.path = file.path;
				}

				await new Promise<void>((resolve, reject) => {
					const dataRequest = dataStore.put(storedData);
					dataRequest.onsuccess = () => resolve();
					dataRequest.onerror = () => reject(dataRequest.error);
				});

				// Save file handle if available
				if (file.handle) {
					const storedHandle: StoredFileHandle = {
						name: file.name,
						handle: file.handle,
						lastModified: file.lastModified || Date.now(),
					};

					if (file.path) {
						storedHandle.path = file.path;
					}

					await new Promise<void>((resolve, reject) => {
						const handleRequest = handlesStore.put(storedHandle);
						handleRequest.onsuccess = () => resolve();
						handleRequest.onerror = () => reject(handleRequest.error);
					});
				}
			}

			db.close();
		} catch (error) {
			console.warn("Failed to save files to IndexedDB:", error);
			// Fallback to localStorage for data only
			this.fallbackToLocalStorage(files);
		}
	}

	/**
	 * Load files with automatic handle restoration and permission re-request
	 */
	static async loadFiles(): Promise<FileData[]> {
		try {
			const db = await this.initDB();
			const transaction = db.transaction(
				[this.HANDLES_STORE, this.DATA_STORE],
				"readonly"
			);
			const handlesStore = transaction.objectStore(this.HANDLES_STORE);
			const dataStore = transaction.objectStore(this.DATA_STORE);

			// Load file data
			const storedData = await new Promise<StoredFileData[]>(
				(resolve, reject) => {
					const request = dataStore.getAll();
					request.onsuccess = () => resolve(request.result);
					request.onerror = () => reject(request.error);
				}
			);

			// Load file handles
			const storedHandles = await new Promise<StoredFileHandle[]>(
				(resolve, reject) => {
					const request = handlesStore.getAll();
					request.onsuccess = () => resolve(request.result);
					request.onerror = () => reject(request.error);
				}
			);

			db.close();

			// Combine data and handles
			const restoredFiles: FileData[] = [];

			for (const data of storedData) {
				const storedHandle = storedHandles.find((h) => h.name === data.name);

				const fileData: FileData = {
					name: data.name,
					handle: null, // Will be set if handle is valid
					type: data.type,
					content: data.content, // Raw string content, will be parsed later
					originalContent: data.content,
					lastModified: data.lastModified,
					size: data.size,
				};

				if (data.path) {
					fileData.path = data.path;
				}

				// Try to restore handle with permission check
				if (storedHandle) {
					try {
						// Check if we still have permission to access the file (if method exists)
						if (
							"queryPermission" in storedHandle.handle &&
							typeof storedHandle.handle.queryPermission === "function"
						) {
							const permission = await (
								storedHandle.handle as any
							).queryPermission({ mode: "readwrite" });

							if (permission === "granted") {
								// Permission still valid, use the handle
								fileData.handle = storedHandle.handle;
							} else {
								// Permission is 'prompt' or 'denied' - store handle but mark as needing permission
								// The PermissionManager will handle user interaction later
								fileData.handle = storedHandle.handle;
								fileData.permissionDenied = true;
							}
						} else {
							// No permission methods available, assume handle is valid
							fileData.handle = storedHandle.handle;
						}
					} catch (error) {
						// Handle might be invalid (file moved/deleted), handle remains null
						console.warn(`Could not restore handle for ${data.name}:`, error);
					}
				}

				restoredFiles.push(fileData);
			}

			return restoredFiles;
		} catch (error) {
			console.warn("Failed to load files from IndexedDB:", error);
			// Fallback to localStorage
			return this.fallbackLoadFromLocalStorage();
		}
	}

	/**
	 * Automatically refresh files that have valid handles
	 */
	static async autoRefreshFiles(files: FileData[]): Promise<FileData[]> {
		const refreshedFiles: FileData[] = [];

		for (const file of files) {
			if (file.handle) {
				try {
					// Check permission if method exists (modern browsers)
					if (
						"queryPermission" in file.handle &&
						typeof file.handle.queryPermission === "function"
					) {
						const permission = await (file.handle as any).queryPermission({
							mode: "readwrite",
						});

						if (permission === "denied") {
							// Permission denied, mark file and keep original
							refreshedFiles.push({
								...file,
								permissionDenied: true,
								autoRefreshed: false,
							});
							continue;
						} else if (permission === "prompt") {
							// Permission needed but don't automatically request it
							// The PermissionManager will handle user interaction later
							refreshedFiles.push({
								...file,
								permissionDenied: true,
								autoRefreshed: false,
							});
							continue;
						}
					}

					// Try to get fresh content from disk
					const diskFile = await file.handle.getFile();
					const content = await diskFile.text();

					// Check if file was modified
					if (diskFile.lastModified !== file.lastModified) {
						console.log(`🔄 Auto-refreshed: ${file.name} (modified on disk)`);

						refreshedFiles.push({
							...file,
							content: content,
							originalContent: content,
							lastModified: diskFile.lastModified,
							size: diskFile.size,
							autoRefreshed: true,
							permissionDenied: false,
						});
					} else {
						// File unchanged, keep original but mark as checked
						refreshedFiles.push({
							...file,
							autoRefreshed: false,
							permissionDenied: false,
						});
					}
				} catch (error) {
					console.warn(`Could not auto-refresh ${file.name}:`, error);
					// Keep original file data if refresh fails
					refreshedFiles.push({
						...file,
						autoRefreshed: false,
						permissionDenied: true,
					});
				}
			} else {
				// No handle, keep as storage file
				refreshedFiles.push({
					...file,
					autoRefreshed: false,
					permissionDenied: false,
				});
			}
		}

		return refreshedFiles;
	}

	/**
	 * Remove specific file from both stores
	 */
	static async removeFile(filename: string): Promise<void> {
		try {
			const db = await this.initDB();
			const transaction = db.transaction(
				[this.HANDLES_STORE, this.DATA_STORE],
				"readwrite"
			);
			const handlesStore = transaction.objectStore(this.HANDLES_STORE);
			const dataStore = transaction.objectStore(this.DATA_STORE);

			await Promise.all([
				new Promise<void>((resolve, reject) => {
					const request = handlesStore.delete(filename);
					request.onsuccess = () => resolve();
					request.onerror = () => reject(request.error);
				}),
				new Promise<void>((resolve, reject) => {
					const request = dataStore.delete(filename);
					request.onsuccess = () => resolve();
					request.onerror = () => reject(request.error);
				}),
			]);

			db.close();
		} catch (error) {
			console.warn("Failed to remove file from IndexedDB:", error);
		}
	}

	/**
	 * Clear all stored data
	 */
	static async clearAll(): Promise<void> {
		try {
			const db = await this.initDB();
			const transaction = db.transaction(
				[this.HANDLES_STORE, this.DATA_STORE],
				"readwrite"
			);
			const handlesStore = transaction.objectStore(this.HANDLES_STORE);
			const dataStore = transaction.objectStore(this.DATA_STORE);

			await Promise.all([
				new Promise<void>((resolve, reject) => {
					const request = handlesStore.clear();
					request.onsuccess = () => resolve();
					request.onerror = () => reject(request.error);
				}),
				new Promise<void>((resolve, reject) => {
					const request = dataStore.clear();
					request.onsuccess = () => resolve();
					request.onerror = () => reject(request.error);
				}),
			]);

			db.close();

			// Also clear localStorage fallback
			localStorage.removeItem("konficurator_files");
			localStorage.removeItem("konficurator_version");
		} catch (error) {
			console.warn("Failed to clear IndexedDB:", error);
		}
	}

	/**
	 * Check how many files have active handles vs storage only
	 */
	static async getStorageStatus(): Promise<{
		totalFiles: number;
		withHandles: number;
		storageOnly: number;
	}> {
		try {
			const files = await this.loadFiles();
			const withHandles = files.filter((f) => f.handle !== null).length;
			const storageOnly = files.length - withHandles;

			return {
				totalFiles: files.length,
				withHandles,
				storageOnly,
			};
		} catch (error) {
			return { totalFiles: 0, withHandles: 0, storageOnly: 0 };
		}
	}

	/**
	 * Fallback to localStorage for browsers without IndexedDB
	 */
	private static fallbackToLocalStorage(files: FileData[]): void {
		try {
			const storedFiles: StoredFileData[] = files.map((file) => {
				const stored: StoredFileData = {
					name: file.name,
					type: file.type,
					lastModified: file.lastModified || Date.now(),
					content: file.originalContent,
					size: file.size || file.originalContent.length,
				};

				if (file.path) {
					stored.path = file.path;
				}

				return stored;
			});

			localStorage.setItem("konficurator_files", JSON.stringify(storedFiles));
			localStorage.setItem("konficurator_version", "1.1.0");
		} catch (error) {
			console.warn("Failed to save to localStorage fallback:", error);
		}
	}

	/**
	 * Fallback loading from localStorage
	 */
	private static fallbackLoadFromLocalStorage(): FileData[] {
		try {
			const storedData = localStorage.getItem("konficurator_files");
			if (!storedData) return [];

			const storedFiles: StoredFileData[] = JSON.parse(storedData);
			return storedFiles.map((stored) => {
				const fileData: FileData = {
					name: stored.name,
					handle: null,
					type: stored.type,
					content: stored.content,
					originalContent: stored.content,
					lastModified: stored.lastModified,
					size: stored.size,
				};

				if (stored.path) {
					fileData.path = stored.path;
				}

				return fileData;
			});
		} catch (error) {
			console.warn("Failed to load from localStorage fallback:", error);
			return [];
		}
	}
}
