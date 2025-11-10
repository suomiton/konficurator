import { FileHandler } from "./fileHandler";
import { ParserFactory } from "./parsers";
import { ModernFormRenderer } from "./ui/modern-form-renderer";
import { FilePersistence } from "./persistence";
import { FileData } from "./interfaces";
import { StorageService } from "./handleStorage";
import { NotificationService, FileNotifications } from "./ui/notifications";
import { PermissionManager } from "./permissionManager";
import { createElement } from "./ui/dom-factory";
import { createIconLabel, createIconList, IconListItem } from "./ui/icon";
import {
	showAddFilesDialog,
	showEditGroupDialog,
} from "./ui/group-file-dialog";

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
	private groupColors: Map<string, string> = new Map();

	constructor() {
		this.fileHandler = new FileHandler();
		this.renderer = new ModernFormRenderer({
			onFileFieldChange: (fileId) => this.scheduleAutosave(fileId),
		});
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
		// Ensure the file list (with the Add button) is visible even when there are no files yet
		this.updateFileInfo(this.loadedFiles);
	}

	/**
	 * Set up event listeners
	 */
	private setupEventListeners(): void {
		// Direct binding removed; Add file button rendered dynamically as part of file list

		// Listen for file permission granted events
		window.addEventListener("filePermissionGranted", async (event: Event) => {
			const customEvent = event as CustomEvent;
			const { file } = customEvent.detail as { file: FileData };

			await this.processFile(file);

			// Update existing file (by id) or add new one while preserving visibility state
			const existingIndex = this.loadedFiles.findIndex((f) => f.id === file.id);
			if (existingIndex >= 0) {
				const existingFile = this.loadedFiles[existingIndex];
				const resolvedIsActive =
					existingFile.isActive === false
						? false
						: file.isActive ?? existingFile.isActive ?? true;
				const mergedFile: FileData = {
					...existingFile,
					...file,
					isActive: resolvedIsActive,
				};
				this.loadedFiles[existingIndex] = mergedFile;
			} else {
				if (file.isActive === undefined) {
					file.isActive = true;
				}
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

			// Handle dynamic Add file tag
			if (
				target &&
				(target.id === "selectFiles" || target.closest("#selectFiles"))
			) {
				this.handleAddFilesWithGrouping();
				return;
			}

			// Use event delegation with closest() so inner icon clicks also work
			const removeBtn = target.closest(
				".remove-file-btn"
			) as HTMLElement | null;
			if (removeBtn) {
				const id = removeBtn.getAttribute("data-id");
				if (id) this.handleFileRemove(id);
				return;
			}

			const reloadBtn = target.closest(
				".reload-from-disk-btn"
			) as HTMLElement | null;
			if (reloadBtn) {
				const id = reloadBtn.getAttribute("data-id");
				if (id) this.handleReloadFromDisk(id);
				return;
			}

			const minimizeBtn = target.closest(
				".minimize-file-btn"
			) as HTMLElement | null;
			if (minimizeBtn) {
				const id = minimizeBtn.getAttribute("data-id");
				if (id) this.toggleFileVisibility(id);
				return;
			}

			const saveBtn = target.closest(".btn") as HTMLElement | null;
			if (saveBtn && saveBtn.textContent?.includes("Save")) {
				const id = saveBtn.getAttribute("data-id");
				if (id) this.handleFileSave(id);
				return;
			}

			if (target.classList.contains("file-group-title")) {
				const group = target.getAttribute("data-group");
				if (group) this.handleGroupTitleClick(group);
			}
		});

		// Autosave binding: listen globally for field changes dispatched via custom events
		document.addEventListener("konficurator:fileFieldChanged", (e) => {
			const detail = (e as CustomEvent).detail as {
				fileId: string;
				path: string;
				value: any;
				fieldType: string;
			};
			if (!detail?.fileId) return;
			// Schedule debounced save for this file
			this.scheduleAutosave(detail.fileId);
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
	private async handleAddFilesWithGrouping(): Promise<void> {
		try {
			// Show group picker dialog
			const existingGroups = this.getExistingGroups();
			const selection = await showAddFilesDialog(existingGroups);
			if (!selection) return;
			const { group, color } = selection;
			if (color) this.groupColors.set(group, color);

			NotificationService.showLoading("Selecting files...");
			// Only consider duplicates within the target group
			const existingInGroup = this.loadedFiles.filter((f) => f.group === group);
			const newFiles = await this.fileHandler.selectFiles(
				group,
				existingInGroup,
				color || this.groupColors.get(group)
			);

			// Always restore current editors immediately (prevent flicker / hidden state)
			this.renderFileEditors();
			this.updateFileInfo(this.loadedFiles);

			if (newFiles.length === 0) {
				NotificationService.hideLoading();
				return;
			}

			for (const fileData of newFiles) {
				if (fileData.isActive === undefined) fileData.isActive = true;
				await this.processFile(fileData);
			}

			this.loadedFiles.push(...newFiles);
			await this.saveToStorage();
			this.updateFileInfo(this.loadedFiles);
			this.renderFileEditors();

			FileNotifications.showFilesLoaded(
				newFiles.length,
				newFiles.map((f) => `${f.name}`)
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			NotificationService.showError(`Failed to load files: ${message}`);
			// Ensure UI restored even on error
			this.renderFileEditors();
			this.updateFileInfo(this.loadedFiles);
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

		// Static CSS now loaded from styles/groups.css (no inline injection)

		// Use dedicated list container to avoid removing the Add file button
		let listContainer = document.getElementById("fileInfoListContainer");
		if (!listContainer) {
			listContainer = createElement({
				tag: "div",
				className: "file-list-container",
				attributes: { id: "fileInfoListContainer" },
			});
			fileInfo.appendChild(listContainer);
		}

		const fileList = createElement({
			tag: "div",
			className: "file-list",
		});

		// Group by group name
		const groups = new Map<string, FileData[]>();
		files.forEach((f) => {
			const arr = groups.get(f.group) || [];
			arr.push(f);
			groups.set(f.group, arr);
		});

		groups.forEach((groupFiles, groupName) => {
			const color =
				this.groupColors.get(groupName) || groupFiles[0]?.groupColor;
			if (color) this.groupColors.set(groupName, color!);

			const groupContainer = createElement({
				tag: "div",
				className: "file-group",
			});
			// Apply group border color if available
			// Apply group color to file entry border if available
			if (color) {
				(groupContainer as HTMLElement).style.borderColor = color;
			}

			const header = createElement({
				tag: "div",
				className: "file-group-header",
			});
			// Group title button (remains clickable)
			const title = createElement({
				tag: "button",
				className: "file-group-title",
				textContent: groupName,
				attributes: { "data-group": groupName, type: "button" },
			});
			header.appendChild(title);

			const groupList = createElement({
				tag: "div",
				className: "file-group-list",
			});
			groupFiles.forEach((file) => {
				const fileTag = createElement({
					tag: "span",
					className: "file-tag",
					attributes: { "data-id": file.id },
				});
				if (file.isActive === false) fileTag.classList.add("inactive");
				fileTag.textContent = file.name;
				if (color) {
					(fileTag as HTMLElement).style.borderColor = color;
				}

				const baseTooltip = file.handle
					? "File loaded from disk - can be refreshed"
					: "File restored from storage - use reload button to get latest version";
				fileTag.title = `${baseTooltip}. Click to ${
					file.isActive === false ? "show" : "hide"
				} editor.`;
				fileTag.addEventListener("click", () =>
					this.toggleFileVisibility(file.id)
				);
				groupList.appendChild(fileTag);
			});

			groupContainer.appendChild(header);
			groupContainer.appendChild(groupList);
			fileList.appendChild(groupContainer);
		});

		// Add dynamic "Add file" pseudo-tag at end
		const addTag = createElement({
			tag: "button",
			className: "file-tag add-file-tag",
			attributes: {
				id: "selectFiles",
				type: "button",
				title: "Add configuration file",
			},
			textContent: "+ Add",
		});
		fileList.appendChild(addTag);

		// Replace only the list container contents
		listContainer.innerHTML = "";
		listContainer.appendChild(fileList);
		fileInfo.classList.add("visible");
	}

	/**
	 * Toggle file editor visibility
	 */
	private toggleFileVisibility(fileId: string): void {
		const fileData = this.loadedFiles.find((f) => f.id === fileId);
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

		// No toast/notification for minimize/restore to reduce noise
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
	private async handleFileSave(fileId: string): Promise<void> {
		// Prevent concurrent save operations on the same file
		if (this.activeSaveOperations.has(fileId)) {
			console.warn(`Save operation already in progress for ${fileId}`);
			return;
		}

		this.activeSaveOperations.add(fileId);

		try {
			const fileData = this.loadedFiles.find((f) => f.id === fileId);
			if (!fileData) {
				throw new Error(`File not found`);
			}

			// Check if file has been modified on disk before saving
			if (fileData.handle) {
				const isModifiedOnDisk = await this.fileHandler.isFileModifiedOnDisk(
					fileData
				);

				if (isModifiedOnDisk) {
					// Import the ConfirmationDialog
					const { ConfirmationDialog } = await import("./confirmation");

					// Show file conflict dialog
					const choice = await ConfirmationDialog.showFileConflictDialog(
						fileData.name
					);

					switch (choice) {
						case "cancel":
							// User cancelled, don't save
							return;

						case "refresh":
							// Refresh the file content from disk
							await this.handleFileRefresh(fileId);
							return;

						case "overwrite":
							// Continue with save operation (break out of this block)
							break;
					}
				}
			}

			// Robust form element finding with retry logic for race conditions
			const formElement = await this.findFormElementWithRetry(fileId);
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
					console.warn(
						`Could not update lastModified for ${fileData.name}:`,
						error
					);
				}
			}

			// Update storage after successful save
			await this.saveToStorage();

			// Success: no toast for autosave to avoid noise
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			NotificationService.showError(`Failed to save: ${message}`);
		} finally {
			// Always remove from active operations
			this.activeSaveOperations.delete(fileId);
		}
	}

	// Debounced instant save support
	private pendingAutosaveTimers: Map<string, number> = new Map();

	public scheduleAutosave(fileId: string, delay: number = 600): void {
		// Clear any existing timer for this file
		const existing = this.pendingAutosaveTimers.get(fileId);
		if (existing) {
			clearTimeout(existing);
		}
		const timer = window.setTimeout(async () => {
			this.pendingAutosaveTimers.delete(fileId);
			try {
				await this.handleFileSave(fileId);
			} catch (e) {
				console.warn("Autosave failed", e);
			}
		}, delay);
		this.pendingAutosaveTimers.set(fileId, timer);
	}

	/**
	 * Find form element with retry logic to handle potential race conditions
	 */
	private async findFormElementWithRetry(
		fileId: string,
		maxRetries: number = 3
	): Promise<HTMLFormElement | null> {
		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			// Find the main file editor container (not buttons or other elements with data-file)
			const editorElement = document.querySelector(
				`div.file-editor[data-id="${fileId}"]`
			);
			if (!editorElement) {
				console.warn(
					`Attempt ${attempt}: File editor container not found for ${fileId}`
				);
				if (attempt === maxRetries) {
					// Final attempt: provide debugging info
					const allEditorElements = document.querySelectorAll(
						"div.file-editor[data-id]"
					);
					console.error(
						`Available file editor elements: ${Array.from(allEditorElements)
							.map((el) => el.getAttribute("data-id"))
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
					`Attempt ${attempt}: Form not found in file editor container for ${fileId}`
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
			console.log(`Form found for ${fileId} on attempt ${attempt}`);
			return formElement;
		}

		return null;
	}

	/**
	 * Handle file refresh operation - reload content from disk
	 */
	private async handleFileRefresh(fileId: string): Promise<void> {
		try {
			const fileData = this.loadedFiles.find((f) => f.id === fileId);
			if (!fileData) {
				throw new Error(`File not found`);
			}

			NotificationService.showLoading(`Refreshing ${fileData.name}...`);

			// Refresh file content from disk
			const refreshedFileData = await this.fileHandler.refreshFile(fileData);

			// Process the refreshed file (parse content)
			await this.processFile(refreshedFileData);

			// Update the file in loaded files array
			const fileIndex = this.loadedFiles.findIndex((f) => f.id === fileId);
			if (fileIndex !== -1) {
				this.loadedFiles[fileIndex] = refreshedFileData;
			}

			// Update storage with fresh content
			await this.saveToStorage();

			// Re-render the specific file editor
			this.renderFileEditors();

			NotificationService.hideLoading();

			// Show success message
			FileNotifications.showRefreshSuccess(fileData.name);
		} catch (error) {
			NotificationService.hideLoading();
			const message = error instanceof Error ? error.message : "Unknown error";

			// Show user-friendly error messages
			if (message.includes("No file handle available")) {
				FileNotifications.showNoFileHandle("file");
			} else if (message.includes("File not found")) {
				FileNotifications.showFileNotFound("file");
			} else if (message.includes("Permission denied")) {
				FileNotifications.showPermissionDenied("file");
			} else {
				NotificationService.showError(`Failed to refresh: ${message}`);
			}
		}
	}

	/**
	 * Handle reload from disk operation - select and replace storage file with disk version
	 */
	private async handleReloadFromDisk(fileId: string): Promise<void> {
		try {
			const fileData = this.loadedFiles.find((f) => f.id === fileId);
			if (!fileData) {
				throw new Error(`File not found`);
			}

			NotificationService.showLoading(
				`Selecting ${fileData.name} from disk...`
			);

			// Use file picker to select the specific file from disk
			const newFiles = await this.fileHandler.selectFiles(
				fileData.group,
				[],
				this.groupColors.get(fileData.group)
			);

			// Find the file with matching name
			const matchingFile = newFiles.find((f) => f.name === fileData.name);

			if (!matchingFile) {
				NotificationService.hideLoading();
				NotificationService.showInfo(
					createIconLabel(
						"folder",
						`No file named "${fileData.name}" was selected. Please select the correct file to reload.`,
						{ size: 18 }
					)
				);
				return;
			}

			// Process the new file
			await this.processFile(matchingFile);

			// Replace the old file in loaded files array
			const fileIndex = this.loadedFiles.findIndex((f) => f.id === fileId);
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
				createIconLabel(
					"folder",
					`"${fileData.name}" successfully reloaded from disk with latest content and file handle.`,
					{ size: 18 }
				)
			);
		} catch (error) {
			NotificationService.hideLoading();
			const message = error instanceof Error ? error.message : "Unknown error";

			if (error instanceof Error && error.name === "AbortError") {
				// User cancelled file selection
				NotificationService.showInfo(
					`File selection cancelled. The file remains unchanged.`
				);
			} else {
				NotificationService.showError(`Failed to reload from disk: ${message}`);
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
						createIconLabel(
							"alert-triangle",
							`${filesNeedingPermission.length} file(s) need permission to access. Please grant access using the cards above.`,
							{ size: 18 }
						)
					);
				}

				// Show detailed success message
				const fileNames = refreshedFiles.map((f) => f.name).join(", ");
				const messageItems: IconListItem[] = [
					{
						icon: "folder",
						text: `Restored ${refreshedFiles.length} file(s): ${fileNames}`,
					},
				];

				if (grantedFiles > 0) {
					messageItems.push({
						icon: "check-circle",
						text: `${grantedFiles} file(s) have disk access`,
					});
				}

				if (autoRefreshedCount > 0) {
					messageItems.push({
						icon: "refresh-cw",
						text: `Auto-refreshed ${autoRefreshedCount} file(s) from disk`,
					});
				}

				// Only show info notification if no files need permission
				if (
					permissionDeniedCount === 0 &&
					filesNeedingPermission.length === 0
				) {
					NotificationService.showInfo(
						createIconList(messageItems, { size: 18 })
					);
				}

				return;
			} else {
				// No files in storage - show helpful message for first-time users
				NotificationService.showInfo(
					createIconLabel(
						"help-circle",
						'No saved files found. Use the "Add" button to load configuration files from your computer.',
						{ size: 18 }
					)
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
					createIconLabel(
						"folder",
						`Restored ${storedFiles.length} file(s) from previous session: ${fileNames}`,
						{ size: 18 }
					)
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
	private async handleFileRemove(fileId: string): Promise<void> {
		try {
			const file = this.loadedFiles.find((f) => f.id === fileId);
			if (!file) throw new Error("File not found");

			// Remove from loaded files array
			this.loadedFiles = this.loadedFiles.filter((f) => f.id !== fileId);

			// Update storage
			try {
				await StorageService.removeFile(fileId);
			} catch (error) {
				console.warn(
					"Enhanced storage removal failed, falling back to legacy storage:",
					error
				);
				StorageService.removeFile(fileId);
			}

			// Update UI
			this.updateFileInfo(this.loadedFiles);
			this.renderFileEditors();

			// Show success message
			FileNotifications.showFileRemoved(file.name);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			NotificationService.showError(`Failed to remove file: ${message}`);
		}
	}

	private getExistingGroups(): { name: string; color?: string }[] {
		const seen = new Map<string, string | undefined>();
		for (const f of this.loadedFiles) {
			if (!seen.has(f.group))
				seen.set(f.group, f.groupColor || this.groupColors.get(f.group));
		}
		return Array.from(seen.entries()).map(([name, color]) => {
			const obj: any = { name };
			if (color !== undefined) obj.color = color;
			return obj as { name: string; color?: string };
		});
	}

	private async handleGroupTitleClick(groupName: string): Promise<void> {
		const currentColor =
			this.groupColors.get(groupName) ||
			this.loadedFiles.find((f) => f.group === groupName)?.groupColor;
		const groupArg: any = { name: groupName };
		if (currentColor !== undefined) groupArg.color = currentColor;
		const result = await showEditGroupDialog(
			groupArg as { name: string; color?: string }
		);
		if (!result) return;
		switch (result.type) {
			case "save": {
				const { newName, color } = result;
				// Update files
				this.loadedFiles.forEach((f) => {
					if (f.group === groupName) {
						f.group = newName;
						if (color) f.groupColor = color;
					}
				});
				// Update color map
				const existingColor = color || currentColor;
				if (existingColor) {
					this.groupColors.delete(groupName);
					this.groupColors.set(newName, existingColor);
				}
				await this.saveToStorage();
				this.updateFileInfo(this.loadedFiles);
				this.renderFileEditors();
				NotificationService.showSuccess(
					`Group "${groupName}" renamed to "${newName}"`
				);
				break;
			}
			case "closeAll": {
				this.loadedFiles.forEach((f) => {
					if (f.group === groupName) f.isActive = false;
				});
				await this.saveToStorage();
				this.updateFileInfo(this.loadedFiles);
				this.renderFileEditors();
				NotificationService.showInfo(
					`Closed all files in group "${groupName}"`
				);
				break;
			}
			case "remove": {
				const confirmed = confirm(
					`Remove group "${groupName}" and all its files from the session? This does not delete files from disk.`
				);
				if (!confirmed) return;
				const idsToRemove = this.loadedFiles
					.filter((f) => f.group === groupName)
					.map((f) => f.id);
				this.loadedFiles = this.loadedFiles.filter(
					(f) => f.group !== groupName
				);
				this.groupColors.delete(groupName);
				for (const id of idsToRemove) {
					try {
						await StorageService.removeFile(id);
					} catch {
						/* ignore */
					}
				}
				await this.saveToStorage();
				this.updateFileInfo(this.loadedFiles);
				this.renderFileEditors();
				NotificationService.showSuccess(
					`Removed group "${groupName}" (${idsToRemove.length} file(s))`
				);
				break;
			}
		}
	}

	/**
	 * Show confirmation dialog for file removal
	 */

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
