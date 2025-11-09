/**
 * Permission Manager
 * Handles file permission restoration with user interaction
 */

import { FileData } from "./interfaces";
import { FileNotifications, NotificationService } from "./ui/notifications";
import { createElement } from "./ui/dom-factory";
import { createIconLabel } from "./ui/icon";

export class PermissionManager {
	/**
	 * Restore saved file handles with proper permission management
	 * Shows reconnect cards for files that need user interaction
	 */
	static async restoreSavedHandles(
		files: FileData[],
		onFileRestored: (file: FileData) => Promise<void> = () => Promise.resolve()
	): Promise<{
		restoredFiles: FileData[];
		filesNeedingPermission: FileData[];
	}> {
		if (files.length === 0) {
			return { restoredFiles: [], filesNeedingPermission: [] };
		}

		const restoredFiles: FileData[] = [];
		const filesNeedingPermission: FileData[] = [];

		for (const file of files) {
			if (!file.handle) {
				// File has no handle, add it as-is (storage-only file)
				restoredFiles.push(file);
				try {
					await onFileRestored(file);
				} catch (error) {
					console.error(`Error processing ${file.name}:`, error);
				}
				continue;
			}

			try {
				// Check if permission methods are available
				if (
					"queryPermission" in file.handle &&
					typeof file.handle.queryPermission === "function"
				) {
					const permission = await (file.handle as any).queryPermission({
						mode: "readwrite",
					});

					if (permission === "granted") {
						// Permission already granted, file can be loaded
						restoredFiles.push(file);
						try {
							await onFileRestored(file);
						} catch (error) {
							console.error(`Error processing ${file.name}:`, error);
						}
					} else {
						// Permission needed, show reconnect card
						filesNeedingPermission.push(file);
						this.showReconnectCard(file, onFileRestored);
					}
				} else {
					// No permission methods available, assume handle is valid
					restoredFiles.push(file);
					try {
						await onFileRestored(file);
					} catch (error) {
						console.error(`Error processing ${file.name}:`, error);
					}
				}
			} catch (error) {
				console.warn(`Could not check permission for ${file.name}:`, error);
				// File handle might be invalid, add as storage-only
				restoredFiles.push({
					...file,
					handle: null, // Remove invalid handle
					permissionDenied: true,
				});
			}
		}

		// Do not show notification here, let main.ts handle it
		return { restoredFiles, filesNeedingPermission };
	}

	/**
	 * Request permission and reload a specific file
	 */
	static async requestAndReload(
		file: FileData,
		onFileRestored: (file: FileData) => Promise<void>
	): Promise<boolean> {
		if (!file.handle) {
			NotificationService.showError(
				`Cannot restore "${file.name}": No file handle available.`
			);
			return false;
		}

		try {
			// Check if requestPermission is available
			if (
				"requestPermission" in file.handle &&
				typeof file.handle.requestPermission === "function"
			) {
				NotificationService.showLoading(
					`Requesting permission for ${file.name}...`
				);

                                const permission = await (file.handle as any).requestPermission({
                                        mode: "readwrite",
                                });

                                NotificationService.hideLoading();

                                if (permission === "granted") {
                                        // Permission granted, load the file
                                        let restoredFile = { ...file, permissionDenied: false };

                                        if (
                                                restoredFile.handle &&
                                                "getFile" in restoredFile.handle &&
                                                typeof restoredFile.handle.getFile === "function"
                                        ) {
                                                try {
                                                        const fileBlob = await restoredFile.handle.getFile();
                                                        const fileText = await fileBlob.text();

                                                        restoredFile = {
                                                                ...restoredFile,
                                                                content: fileText,
                                                                originalContent: fileText,
                                                                lastModified: fileBlob.lastModified,
                                                                size: fileBlob.size,
                                                        };
                                                } catch (readError) {
                                                        const message =
                                                                readError instanceof Error
                                                                        ? readError.message
                                                                        : "Unknown error";
                                                        NotificationService.showError(
                                                                `Failed to reload "${file.name}" after granting permission: ${message}`
                                                        );
                                                }
                                        }

                                        await onFileRestored(restoredFile);

                                        // Remove the reconnect card for this file
                                        const reconnectContainer = document.getElementById("reconnectCards");
                                        if (reconnectContainer) {
                                                const existingCards = reconnectContainer.querySelectorAll(
							`[data-reconnect-file="${file.name}"]`
						);
						existingCards.forEach((card) => card.remove());
					}

					// Trigger a custom event to notify main app to update UI
					window.dispatchEvent(
						new CustomEvent("filePermissionGranted", {
							detail: { file: restoredFile },
						})
					);

                                        NotificationService.showSuccess(
                                                createIconLabel(
                                                        "check-circle",
                                                        `Access granted to "${file.name}". File loaded successfully.`,
                                                        { size: 18 }
                                                )
                                        );
					return true;
				} else {
					// Permission denied
                                        NotificationService.showError(
                                                createIconLabel(
                                                        "lock",
                                                        `Permission denied for "${file.name}". The file will remain in storage-only mode.`,
                                                        { size: 18 }
                                                )
                                        );
					return false;
				}
			} else {
				// No requestPermission method available
				NotificationService.showError(
					`Cannot request permission for "${file.name}": Browser does not support permission requests.`
				);
				return false;
			}
		} catch (error) {
			NotificationService.hideLoading();
			const message = error instanceof Error ? error.message : "Unknown error";

			if (error instanceof Error && error.name === "SecurityError") {
                                NotificationService.showError(
                                        createIconLabel(
                                                "lock",
                                                `Security error accessing "${file.name}": ${message}`,
                                                { size: 18 }
                                        )
                                );
			} else {
				NotificationService.showError(
					`Failed to request permission for "${file.name}": ${message}`
				);
			}
			return false;
		}
	}

	/**
	 * Show reconnect card for a file that needs permission
	 */
	private static showReconnectCard(
		file: FileData,
		onFileRestored: (file: FileData) => Promise<void>
	): void {
		if (!file.handle) return;

		// Use a dedicated container for reconnect cards
		let reconnectContainer = document.getElementById("reconnectCards");
		if (!reconnectContainer) {
			reconnectContainer = createElement({
				tag: "div",
				attributes: { id: "reconnectCards" },
			});
			// Insert before editorContainer if possible
			const editorContainer = document.getElementById("editorContainer");
			if (editorContainer && editorContainer.parentNode) {
				editorContainer.parentNode.insertBefore(
					reconnectContainer,
					editorContainer
				);
			} else {
				document.body.appendChild(reconnectContainer);
			}
		}

		FileNotifications.showReconnectCard(file.handle, async (handle) => {
			// Remove any existing reconnect cards for this file
			const existingCards = reconnectContainer.querySelectorAll(
				`[data-reconnect-file="${file.name}"]`
			);
			existingCards.forEach((card) => card.remove());

			// Update the file with the new handle and attempt to request permission and reload
			const updatedFile = { ...file, handle };
			await this.requestAndReload(updatedFile, onFileRestored);
		});
	}
}
