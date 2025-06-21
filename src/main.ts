import { FileHandler } from "./fileHandler.js";
import { ParserFactory } from "./parsers.js";
import { ModernFormRenderer } from "./ui/modern-form-renderer.js";
import { FilePersistence } from "./persistence.js";
import { FileData } from "./interfaces.js";
import { StorageService } from "./handleStorage.js";
import { NotificationService, FileNotifications } from "./ui/notifications.js";
import { ConfirmationDialog } from "./confirmation.js";
import { PermissionManager } from "./permissionManager.js";
import { createElement } from "./ui/dom-factory.js";

/**
 * Main Application Controller
 * Orchestrates all modules following Dependency Inversion Principle
 */
export class KonficuratorApp {
	private fileHandler: FileHandler;
	private renderer: ModernFormRenderer;
	private persistence: FilePersistence;
	private loadedFiles: FileData[] = [];
	private activeSaveOperations: Set<string> = new Set();

	constructor() {
		this.fileHandler = new FileHandler();
		this.renderer = new ModernFormRenderer();
		this.persistence = new FilePersistence();

		this.init();

		// Initialize file loading with error handling
		this.loadPersistedFiles().catch((error) => {
			console.error("Error in loadPersistedFiles:", error);
			NotificationService.showError(
				"Failed to load persisted files: " + error.message
			);
		});
	}

	/**
	 * Initialize the application
	 */
	private init(): void {
		this.setupEventListeners();
		this.checkBrowserSupport();
	}

	/**
	 * Set up event listeners
	 */
	private setupEventListeners(): void {
		const selectFilesBtn = document.getElementById("selectFiles");
		if (selectFilesBtn) {
			selectFilesBtn.addEventListener("click", () =>
				this.handleFileSelection()
			);
		}

		// Listen for file permission granted events
		window.addEventListener("filePermissionGranted", async (event: Event) => {
			const customEvent = event as CustomEvent;
			const { file } = customEvent.detail;

			// Update existing file or add new one
			const existingIndex = this.loadedFiles.findIndex(
				(f) => f.name === file.name
			);
			if (existingIndex >= 0) {
				this.loadedFiles[existingIndex] = file;
			} else {
				this.loadedFiles.push(file);
			}

			// Update UI and storage
			this.updateFileInfo(this.loadedFiles);
			this.renderFileEditors();
			await this.saveToStorage();
		});

		// Delegate save button clicks
		document.addEventListener("click", (event) => {
			const target = event.target as HTMLElement;

			if (target.classList.contains("remove-file-btn")) {
				const filename = target.getAttribute("data-file");
				if (filename) {
					this.handleFileRemove(filename);
				}
			} else if (target.classList.contains("refresh-file-btn")) {
				const filename = target.getAttribute("data-file");
				if (filename) {
					this.handleFileRefresh(filename);
				}
			} else if (target.classList.contains("reload-from-disk-btn")) {
				const filename = target.getAttribute("data-file");
				if (filename) {
					this.handleReloadFromDisk(filename);
				}
			} else if (
				target.classList.contains("btn") &&
				target.textContent?.includes("Save")
			) {
				const filename = target.getAttribute("data-file");
				if (filename) {
					this.handleFileSave(filename);
				}
			}
		});
	}

	/**
	 * Check if browser supports required APIs
	 */
	private checkBrowserSupport(): void {
		if (!window.showOpenFilePicker) {
			NotificationService.showErrorInContainer(
				"Your browser does not support the File System Access API. " +
					"Please use a modern browser like Chrome, Edge, or Opera."
			);
		}
	}

	/**
	 * Handle file selection
	 */
	private async handleFileSelection(): Promise<void> {
		try {
			NotificationService.showLoading("Selecting files...");

			const newFiles = await this.fileHandler.selectFiles(this.loadedFiles);

			if (newFiles.length === 0) {
				NotificationService.hideLoading();
				return;
			}
			// Process new files and add to existing ones
			for (const fileData of newFiles) {
				// Ensure new files are active by default
				if (fileData.isActive === undefined) {
					fileData.isActive = true;
				}
				await this.processFile(fileData);
			}

			// Add new files to existing loaded files
			this.loadedFiles.push(...newFiles);

			// Save to storage
			await this.saveToStorage();

			this.updateFileInfo(this.loadedFiles);
			this.renderFileEditors();

			// Show success message for new files
			const filenames = newFiles.map((f) => f.name);
			FileNotifications.showFilesLoaded(newFiles.length, filenames);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			NotificationService.showError(`Failed to load files: ${message}`);
		} finally {
			NotificationService.hideLoading();
		}
	}

	/**
	 * Process individual file (parse and prepare)
	 */
	private async processFile(fileData: FileData): Promise<void> {
		try {
			const parser = ParserFactory.createParser(
				fileData.type,
				fileData.content
			);
			const parsedContent = parser.parse(fileData.content);

			// Update file data with parsed content
			fileData.content = parsedContent;
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			console.error(`Failed to parse ${fileData.name}:`, error);
			// Still keep file but with error flag
			fileData.content = { _error: message };
		}
	}

	/**
	 * Update file info display
	 */
	private updateFileInfo(files: FileData[]): void {
		const fileInfo = document.getElementById("fileInfo");
		if (!fileInfo) return;

		const fileList = createElement({
			tag: "div",
			className: "file-list",
		});

		files.forEach((file) => {
			const fileTag = createElement({
				tag: "span",
				className: "file-tag",
				attributes: { "data-file": file.name },
			});

			// Add inactive class if file is inactive
			if (file.isActive === false) {
				fileTag.classList.add("inactive");
			}

			// Add visual indicator for file source
			const indicator = file.handle ? "🖥️" : "💾";
			fileTag.textContent = `${indicator} ${
				file.name
			} (${file.type.toUpperCase()})`;

			// Add tooltip
			const baseTooltip = file.handle
				? "File loaded from disk - can be refreshed"
				: "File restored from storage - use reload button to get latest version";

			fileTag.title = `${baseTooltip}. Click to ${
				file.isActive === false ? "show" : "hide"
			} editor.`;

			// Add click event to toggle file visibility
			fileTag.addEventListener("click", () => {
				this.toggleFileVisibility(file.name);
			});

			fileList.appendChild(fileTag);
		});

		fileInfo.innerHTML = "";
		fileInfo.appendChild(fileList);
		fileInfo.classList.add("visible");
	}

	/**
	 * Toggle file editor visibility
	 */
	private toggleFileVisibility(filename: string): void {
		const fileData = this.loadedFiles.find((f) => f.name === filename);
		if (!fileData) return;

		// Toggle the isActive state (default to true if undefined)
		fileData.isActive = fileData.isActive === false ? true : false;

		// Update UI to reflect the change
		this.updateFileInfo(this.loadedFiles);
		this.renderFileEditors();

		// Update storage to persist the state
		this.saveToStorage().catch((error) => {
			console.warn("Failed to save file visibility state:", error);
		});

		// Show notification
		const action = fileData.isActive ? "shown" : "hidden";
		NotificationService.showInfo(
			`📄 Editor for "${filename}" is now ${action}.`
		);
	}

	/**
	 * Render file editors for all loaded files
	 */
	private renderFileEditors(): void {
		const container = document.getElementById("editorContainer");
		if (!container) return;

		container.innerHTML = "";

		// Only render editors for active files (isActive is true or undefined)
		this.loadedFiles
			.filter((fileData) => fileData.isActive !== false)
			.forEach((fileData) => {
				const editorElement = this.renderer.renderFileEditor(fileData);
				container.appendChild(editorElement);
			});
	}

	/**
	 * Handle file save operation
	 */
	private async handleFileSave(filename: string): Promise<void> {
		// Prevent concurrent save operations on the same file
		if (this.activeSaveOperations.has(filename)) {
			console.warn(`Save operation already in progress for ${filename}`);
			return;
		}

		this.activeSaveOperations.add(filename);

		try {
			const fileData = this.loadedFiles.find((f) => f.name === filename);
			if (!fileData) {
				throw new Error(`File ${filename} not found`);
			}

			// Check if file has been modified on disk before saving
			if (fileData.handle) {
				const isModifiedOnDisk = await this.fileHandler.isFileModifiedOnDisk(
					fileData
				);

				if (isModifiedOnDisk) {
					// Import the ConfirmationDialog
					const { ConfirmationDialog } = await import("./confirmation.js");

					// Show file conflict dialog
					const choice = await ConfirmationDialog.showFileConflictDialog(
						filename
					);

					switch (choice) {
						case "cancel":
							// User cancelled, don't save
							return;

						case "refresh":
							// Refresh the file content from disk
							await this.handleFileRefresh(filename);
							return;

						case "overwrite":
							// Continue with save operation (break out of this block)
							break;
					}
				}
			}

			// Robust form element finding with retry logic for race conditions
			const formElement = await this.findFormElementWithRetry(filename);
			if (!formElement) {
				throw new Error("Form not found after retries");
			}

			await this.persistence.saveFile(fileData, formElement);

			// Update file's lastModified timestamp after successful save
			if (fileData.handle) {
				try {
					const file = await fileData.handle.getFile();
					fileData.lastModified = file.lastModified;
				} catch (error) {
					console.warn(`Could not update lastModified for ${filename}:`, error);
				}
			}

			// Update storage after successful save
			await this.saveToStorage();

			// Show success message
			FileNotifications.showSaveSuccess(filename);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			NotificationService.showError(`Failed to save ${filename}: ${message}`);
		} finally {
			// Always remove from active operations
			this.activeSaveOperations.delete(filename);
		}
	}

	/**
	 * Find form element with retry logic to handle potential race conditions
	 */
	private async findFormElementWithRetry(
		filename: string,
		maxRetries: number = 3
	): Promise<HTMLFormElement | null> {
		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			// Find the main file editor container (not buttons or other elements with data-file)
			const editorElement = document.querySelector(
				`div.file-editor[data-file="${filename}"]`
			);
			if (!editorElement) {
				console.warn(
					`Attempt ${attempt}: File editor container not found for ${filename}`
				);
				if (attempt === maxRetries) {
					// Final attempt: provide debugging info
					const allEditorElements = document.querySelectorAll(
						"div.file-editor[data-file]"
					);
					console.error(
						`Available file editor elements: ${Array.from(allEditorElements)
							.map((el) => el.getAttribute("data-file"))
							.join(", ")}`
					);
					return null;
				}
				await new Promise((resolve) => setTimeout(resolve, 100)); // Wait 100ms before retry
				continue;
			}

			// Find form element within the file editor container
			const formElement = editorElement.querySelector(
				"form"
			) as HTMLFormElement;
			if (!formElement) {
				console.warn(
					`Attempt ${attempt}: Form not found in file editor container for ${filename}`
				);
				if (attempt === maxRetries) {
					// Final attempt: provide debugging info
					const children = Array.from(editorElement.children);
					console.error(
						`File editor container children: ${children
							.map((c) => `${c.tagName}.${c.className}`)
							.join(", ")}`
					);
					return null;
				}
				await new Promise((resolve) => setTimeout(resolve, 100)); // Wait 100ms before retry
				continue;
			}

			// Success!
			console.log(`Form found for ${filename} on attempt ${attempt}`);
			return formElement;
		}

		return null;
	}

	/**
	 * Handle file refresh operation - reload content from disk
	 */
	private async handleFileRefresh(filename: string): Promise<void> {
		try {
			const fileData = this.loadedFiles.find((f) => f.name === filename);
			if (!fileData) {
				throw new Error(`File ${filename} not found`);
			}

			NotificationService.showLoading(`Refreshing ${filename}...`);

			// Refresh file content from disk
			const refreshedFileData = await this.fileHandler.refreshFile(fileData);

			// Process the refreshed file (parse content)
			await this.processFile(refreshedFileData);

			// Update the file in loaded files array
			const fileIndex = this.loadedFiles.findIndex((f) => f.name === filename);
			if (fileIndex !== -1) {
				this.loadedFiles[fileIndex] = refreshedFileData;
			}

			// Update storage with fresh content
			await this.saveToStorage();

			// Re-render the specific file editor
			this.renderFileEditors();

			NotificationService.hideLoading();

			// Show success message
			FileNotifications.showRefreshSuccess(filename);
		} catch (error) {
			NotificationService.hideLoading();
			const message = error instanceof Error ? error.message : "Unknown error";

			// Show user-friendly error messages
			if (message.includes("No file handle available")) {
				FileNotifications.showNoFileHandle(filename);
			} else if (message.includes("File not found")) {
				FileNotifications.showFileNotFound(filename);
			} else if (message.includes("Permission denied")) {
				FileNotifications.showPermissionDenied(filename);
			} else {
				NotificationService.showError(
					`Failed to refresh "${filename}": ${message}`
				);
			}
		}
	}

	/**
	 * Handle reload from disk operation - select and replace storage file with disk version
	 */
	private async handleReloadFromDisk(filename: string): Promise<void> {
		try {
			const fileData = this.loadedFiles.find((f) => f.name === filename);
			if (!fileData) {
				throw new Error(`File ${filename} not found`);
			}

			NotificationService.showLoading(`Selecting ${filename} from disk...`);

			// Use file picker to select the specific file from disk
			const newFiles = await this.fileHandler.selectFiles([]);

			// Find the file with matching name
			const matchingFile = newFiles.find((f) => f.name === filename);

			if (!matchingFile) {
				NotificationService.hideLoading();
				NotificationService.showInfo(
					`📁 No file named "${filename}" was selected. Please select the correct file to reload.`
				);
				return;
			}

			// Process the new file
			await this.processFile(matchingFile);

			// Replace the old file in loaded files array
			const fileIndex = this.loadedFiles.findIndex((f) => f.name === filename);
			if (fileIndex !== -1) {
				this.loadedFiles[fileIndex] = matchingFile;
			}

			// Update storage with fresh content and file handle
			await this.saveToStorage();

			// Re-render the specific file editor
			this.renderFileEditors();

			NotificationService.hideLoading();

			// Show success message
			NotificationService.showSuccess(
				`📁 "${filename}" successfully reloaded from disk with latest content and file handle.`
			);
		} catch (error) {
			NotificationService.hideLoading();
			const message = error instanceof Error ? error.message : "Unknown error";

			if (error instanceof Error && error.name === "AbortError") {
				// User cancelled file selection
				NotificationService.showInfo(
					`File selection cancelled. "${filename}" remains unchanged.`
				);
			} else {
				NotificationService.showError(
					`Failed to reload "${filename}" from disk: ${message}`
				);
			}
		}
	}

	/**
	 * Load persisted files from browser storage with automatic file refresh
	 */
	private async loadPersistedFiles(): Promise<void> {
		// Try enhanced storage first
		try {
			const restoredFiles = await StorageService.loadFiles();

			if (restoredFiles.length > 0) {
				NotificationService.showLoading(
					`Loading ${restoredFiles.length} persisted file(s)...`
				);

				// Use PermissionManager to handle file restoration with proper permission management
				const { restoredFiles: processedFiles, filesNeedingPermission } =
					await PermissionManager.restoreSavedHandles(restoredFiles);

				// Auto-refresh files that have valid handles and permissions
				const refreshedFiles = await StorageService.autoRefreshFiles(
					processedFiles
				);

				let autoRefreshedCount = 0;
				let permissionDeniedCount = 0;
				let grantedFiles = 0;

				// Process refreshed files and update UI
				for (const fileData of refreshedFiles) {
					await this.processFile(fileData);
					// Ensure restored files are active by default if not explicitly set
					if (fileData.isActive === undefined) {
						fileData.isActive = true;
					}

					if (fileData.autoRefreshed) {
						autoRefreshedCount++;
					}
					if (fileData.permissionDenied) {
						permissionDeniedCount++;
					}
					if (fileData.handle && !fileData.permissionDenied) {
						grantedFiles++;
					}

					// Update existing file or add new one
					const existingIndex = this.loadedFiles.findIndex(
						(f) => f.name === fileData.name
					);
					if (existingIndex >= 0) {
						this.loadedFiles[existingIndex] = fileData;
					} else {
						this.loadedFiles.push(fileData);
					}
				}

				this.updateFileInfo(this.loadedFiles);
				this.renderFileEditors();
				NotificationService.hideLoading();

				// Show permission warning if needed (after hideLoading)
				if (filesNeedingPermission.length > 0) {
					NotificationService.showWarning(
						`⚠️ ${filesNeedingPermission.length} file(s) need permission to access. Please grant access using the cards above.`
					);
				}

				// Show detailed success message
				const fileNames = refreshedFiles.map((f) => f.name).join(", ");
				let message = `📂 Restored ${refreshedFiles.length} file(s): ${fileNames}`;

				if (grantedFiles > 0) {
					message += `\n✅ ${grantedFiles} file(s) have disk access`;
				}

				if (autoRefreshedCount > 0) {
					message += `\n🔄 Auto-refreshed ${autoRefreshedCount} file(s) from disk`;
				}

				// Only show info notification if no files need permission
				if (
					permissionDeniedCount === 0 &&
					filesNeedingPermission.length === 0
				) {
					NotificationService.showInfo(message);
				}

				return;
			} else {
				// No files in storage - show helpful message for first-time users
				NotificationService.showInfo(
					'💡 No saved files found. Use the "Select Files" button to load configuration files from your computer.'
				);
			}
		} catch (error) {
			console.warn(
				"Enhanced storage failed, falling back to legacy storage:",
				error
			);
		}

		// Fallback to legacy storage
		// if (!StorageService.isStorageAvailable()) {
		// 	return;
		// }

		try {
			const storedFiles = await StorageService.loadFiles();
			if (storedFiles.length > 0) {
				NotificationService.showLoading(
					`Loading ${storedFiles.length} persisted file(s)...`
				);

				// Process stored files
				for (const fileData of storedFiles) {
					// Ensure restored files are active by default if not explicitly set
					if (fileData.isActive === undefined) {
						fileData.isActive = true;
					}
					await this.processFile(fileData);
				}

				this.loadedFiles = storedFiles;
				this.updateFileInfo(storedFiles);
				this.renderFileEditors();
				NotificationService.hideLoading();

				// Show success message for restored files
				const fileNames = storedFiles.map((f) => f.name).join(", ");
				NotificationService.showInfo(
					`📂 Restored ${storedFiles.length} file(s) from previous session: ${fileNames}`
				);
			}
		} catch (error) {
			console.warn("Failed to load persisted files:", error);
			// Clear corrupted storage
			StorageService.clearAll();
		}
	}

	/**
	 * Handle file removal
	 */
	private async handleFileRemove(filename: string): Promise<void> {
		try {
			const confirmed = await this.showRemoveConfirmation(filename);
			if (!confirmed) {
				return;
			}

			// Remove from loaded files array
			this.loadedFiles = this.loadedFiles.filter(
				(file) => file.name !== filename
			);

			// Update storage
			try {
				await StorageService.removeFile(filename);
			} catch (error) {
				console.warn(
					"Enhanced storage removal failed, falling back to legacy storage:",
					error
				);
				StorageService.removeFile(filename);
			}

			// Update UI
			this.updateFileInfo(this.loadedFiles);
			this.renderFileEditors();

			// Show success message
			FileNotifications.showFileRemoved(filename);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			NotificationService.showError(`Failed to remove file: ${message}`);
		}
	}

	/**
	 * Show confirmation dialog for file removal
	 */
	private async showRemoveConfirmation(filename: string): Promise<boolean> {
		return await ConfirmationDialog.show(
			"Remove File",
			`Are you sure you want to remove "${filename}" from the editor?\n\nThis will not delete the actual file, only remove it from the current session.`,
			"Remove",
			"Cancel"
		);
	}

	/**
	 * Save files to storage when files change
	 */
	private async saveToStorage(): Promise<void> {
		try {
			// Try enhanced storage first
			await StorageService.saveFiles(this.loadedFiles);
		} catch (error) {
			console.warn(
				"Enhanced storage failed, falling back to legacy storage:",
				error
			);
			// Fallback to legacy storage
			// if (StorageService.isStorageAvailable()) {
			// 	StorageService.saveFiles(this.loadedFiles);
			// }
		}
	}
}

// Initialize the application when DOM is loaded
if (typeof window !== "undefined") {
	document.addEventListener("DOMContentLoaded", () => {
		new KonficuratorApp();
	});
}

// Add global type declarations for File System Access API
declare global {
	interface Window {
		showOpenFilePicker: (options?: {
			multiple?: boolean;
			types?: Array<{
				description: string;
				accept: Record<string, string[]>;
			}>;
		}) => Promise<FileSystemFileHandle[]>;

		showSaveFilePicker: (options?: {
			suggestedName?: string;
			types?: Array<{
				description: string;
				accept: Record<string, string[]>;
			}>;
		}) => Promise<FileSystemFileHandle>;
	}

	interface FileSystemFileHandle {
		getFile(): Promise<File>;
		createWritable(): Promise<FileSystemWritableFileStream>;
		name: string;
	}

	interface FileSystemWritableFileStream {
		write(data: string): Promise<void>;
		close(): Promise<void>;
	}
}
