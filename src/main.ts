import { FileHandler } from "./fileHandler.js";
import { ParserFactory } from "./parsers.js";
import { FormRenderer } from "./renderer.js";
import { FilePersistence } from "./persistence.js";
import { FileData } from "./interfaces.js";

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
			if (
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

			const files = await this.fileHandler.selectFiles();

			if (files.length === 0) {
				this.hideLoading();
				return;
			}

			this.loadedFiles = [];

			for (const fileData of files) {
				await this.processFile(fileData);
			}

			this.updateFileInfo(files);
			this.renderFileEditors();
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
			this.loadedFiles.push(fileData);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			console.error(`Failed to parse ${fileData.name}:`, error);
			// Still add to loaded files but with error flag
			fileData.content = { _error: message };
			this.loadedFiles.push(fileData);
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
