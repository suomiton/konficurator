import { FileHandler } from "./fileHandler.js";
import { ParserFactory } from "./parsers.js";
import { FormRenderer } from "./renderer.js";
import { FilePersistence } from "./persistence.js";
import { FileData } from "./interfaces.js";
import { StorageService } from "./storage.js";

/**
 * Main Application Controller
 * Orchestrates all modules following Dependency Inversion Principle
 */
class KonficuratorApp {
	private fileHandler: FileHandler;
	private renderer: FormRenderer;
	private persistence: FilePersistence;
	private loadedFiles: FileData[] = [];

	constructor() {
		this.fileHandler = new FileHandler();
		this.renderer = new FormRenderer();
		this.persistence = new FilePersistence();

		this.init();
		this.loadPersistedFiles();
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

		// Delegate save button clicks
		document.addEventListener("click", (event) => {
			const target = event.target as HTMLElement;

			if (target.classList.contains("remove-file-btn")) {
				const filename = target.getAttribute("data-file");
				if (filename) {
					this.handleFileRemove(filename);
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
			this.showError(
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
			this.showLoading("Selecting files...");

			const newFiles = await this.fileHandler.selectFiles(this.loadedFiles);

			if (newFiles.length === 0) {
				this.hideLoading();
				return;
			}

			// Process new files and add to existing ones
			for (const fileData of newFiles) {
				await this.processFile(fileData);
			}

			// Add new files to existing loaded files
			this.loadedFiles.push(...newFiles);

			// Save to storage
			this.saveToStorage();

			this.updateFileInfo(this.loadedFiles);
			this.renderFileEditors();

			// Show success message for new files
			if (newFiles.length === 1) {
				this.showTemporaryMessage(
					`Added "${newFiles[0].name}" to editor.`,
					"success"
				);
			} else {
				this.showTemporaryMessage(
					`Added ${newFiles.length} files to editor.`,
					"success"
				);
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			this.showError(`Failed to load files: ${message}`);
		} finally {
			this.hideLoading();
		}
	}

	/**
	 * Process individual file (parse and prepare)
	 */
	private async processFile(fileData: FileData): Promise<void> {
		try {
			const parser = ParserFactory.createParser(fileData.type);
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

		const fileList = document.createElement("div");
		fileList.className = "file-list";

		files.forEach((file) => {
			const fileTag = document.createElement("span");
			fileTag.className = "file-tag";
			fileTag.textContent = `${file.name} (${file.type.toUpperCase()})`;
			fileList.appendChild(fileTag);
		});

		fileInfo.innerHTML = "";
		fileInfo.appendChild(fileList);
		fileInfo.classList.add("visible");
	}

	/**
	 * Render file editors for all loaded files
	 */
	private renderFileEditors(): void {
		const container = document.getElementById("editorContainer");
		if (!container) return;

		container.innerHTML = "";

		this.loadedFiles.forEach((fileData) => {
			const editorElement = this.renderer.renderFileEditor(fileData);
			container.appendChild(editorElement);
		});
	}

	/**
	 * Handle file save operation
	 */
	private async handleFileSave(filename: string): Promise<void> {
		try {
			const fileData = this.loadedFiles.find((f) => f.name === filename);
			if (!fileData) {
				throw new Error(`File ${filename} not found`);
			}

			const editorElement = document.querySelector(`[data-file="${filename}"]`);
			const formElement = editorElement?.querySelector(
				"form"
			) as HTMLFormElement;

			if (!formElement) {
				throw new Error("Form not found");
			}

			await this.persistence.saveFile(fileData, formElement);

			// Update storage after successful save
			this.saveToStorage();

			// Show success message
			this.showTemporaryMessage(`"${filename}" saved successfully.`, "success");
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			this.showError(`Failed to save ${filename}: ${message}`);
		}
	}

	/**
	 * Show loading indicator
	 */
	private showLoading(message: string): void {
		const container = document.getElementById("editorContainer");
		if (container) {
			container.innerHTML = `<div class="loading">${message}</div>`;
		}
	}

	/**
	 * Hide loading indicator
	 */
	private hideLoading(): void {
		// Loading will be replaced by content or cleared
	}

	/**
	 * Show error message
	 */
	private showError(message: string): void {
		const container = document.getElementById("editorContainer");
		if (container) {
			container.innerHTML = `<div class="error">${message}</div>`;
		}
	}

	/**
	 * Load persisted files from browser storage
	 */
	private async loadPersistedFiles(): Promise<void> {
		if (!StorageService.isStorageAvailable()) {
			return;
		}

		try {
			const storedFiles = await StorageService.loadFiles();
			if (storedFiles.length > 0) {
				this.showLoading(`Loading ${storedFiles.length} persisted file(s)...`);

				// Process stored files
				for (const fileData of storedFiles) {
					await this.processFile(fileData);
				}

				this.loadedFiles = storedFiles;
				this.updateFileInfo(storedFiles);
				this.renderFileEditors();
				this.hideLoading();
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
			StorageService.removeFile(filename);

			// Update UI
			this.updateFileInfo(this.loadedFiles);
			this.renderFileEditors();

			// Show success message
			this.showTemporaryMessage(
				`File "${filename}" removed successfully.`,
				"success"
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			this.showError(`Failed to remove file: ${message}`);
		}
	}

	/**
	 * Show confirmation dialog for file removal
	 */
	private async showRemoveConfirmation(filename: string): Promise<boolean> {
		// Simple browser confirmation for now
		return confirm(
			`Are you sure you want to remove "${filename}" from the editor?\n\nThis will not delete the actual file, only remove it from the current session.`
		);
	}

	/**
	 * Show temporary success/info message
	 */
	private showTemporaryMessage(
		message: string,
		type: "success" | "info" = "info"
	): void {
		const messageDiv = document.createElement("div");
		messageDiv.className = `temporary-message ${type}`;
		messageDiv.textContent = message;
		messageDiv.style.cssText = `
			position: fixed;
			top: 20px;
			right: 20px;
			padding: 12px 20px;
			background: ${type === "success" ? "#2ecc71" : "#3498db"};
			color: white;
			border-radius: 4px;
			box-shadow: 0 2px 10px rgba(0,0,0,0.2);
			z-index: 1000;
			animation: slideInRight 0.3s ease-out;
		`;

		document.body.appendChild(messageDiv);

		// Remove after 3 seconds
		setTimeout(() => {
			messageDiv.style.animation = "slideOutRight 0.3s ease-in";
			setTimeout(() => {
				if (messageDiv.parentNode) {
					messageDiv.parentNode.removeChild(messageDiv);
				}
			}, 300);
		}, 3000);
	}

	/**
	 * Save files to storage when files change
	 */
	private saveToStorage(): void {
		if (StorageService.isStorageAvailable()) {
			StorageService.saveFiles(this.loadedFiles);
		}
	}
}

// Initialize the application when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
	new KonficuratorApp();
});

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
