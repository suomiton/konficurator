/**
 * Centralized Notification System
 * Follows Single Responsibility Principle - handles all UI notifications
 */

export type NotificationType = "success" | "error" | "info" | "warning";

export interface NotificationOptions {
	duration?: number; // Duration in milliseconds, 0 for persistent
	position?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
	dismissible?: boolean;
}

/**
 * Centralized notification service following SRP
 * Consolidates all toast/message functionality from across the application
 */
export class NotificationService {
	private static readonly DEFAULT_DURATION = 3000;
	private static readonly DEFAULT_POSITION = "top-right";

	/**
	 * Show a temporary toast notification
	 */
	static showToast(
		message: string,
		type: NotificationType = "info",
		options: NotificationOptions = {}
	): void {
		const {
			duration = this.DEFAULT_DURATION,
			position = this.DEFAULT_POSITION,
			dismissible = true,
		} = options;

		// Remove existing messages of same type to avoid spam
		this.removeExistingToasts();

		const toast = this.createToastElement(message, type, dismissible);
		this.positionToast(toast, position);
		document.body.appendChild(toast);

		// Auto-remove after duration (if not persistent)
		if (duration > 0) {
			setTimeout(() => this.removeToast(toast), duration);
		}
	}

	/**
	 * Show success notification
	 */
	static showSuccess(message: string, options?: NotificationOptions): void {
		this.showToast(message, "success", options);
	}

	/**
	 * Show error notification
	 */
	static showError(message: string, options?: NotificationOptions): void {
		this.showToast(message, "error", { duration: 5000, ...options });
	}

	/**
	 * Show info notification
	 */
	static showInfo(message: string, options?: NotificationOptions): void {
		this.showToast(message, "info", options);
	}

	/**
	 * Show warning notification
	 */
	static showWarning(message: string, options?: NotificationOptions): void {
		this.showToast(message, "warning", options);
	}

	/**
	 * Show loading message (replaces content area)
	 */
	static showLoading(
		message: string,
		containerId: string = "editorContainer"
	): void {
		const container = document.getElementById(containerId);
		if (container) {
			container.innerHTML = `
				<div class="loading">
					<div class="loading-spinner"></div>
					${message}
				</div>
			`;
		}
	}

	/**
	 * Hide loading message
	 */
	static hideLoading(containerId: string = "editorContainer"): void {
		const container = document.getElementById(containerId);
		if (container && container.querySelector(".loading")) {
			container.innerHTML = "";
		}
	}

	/**
	 * Show error in content area (for major errors)
	 */
	static showErrorInContainer(
		message: string,
		containerId: string = "editorContainer"
	): void {
		const container = document.getElementById(containerId);
		if (container) {
			container.innerHTML = `
				<div class="error-container">
					<div class="error-icon">⚠️</div>
					<div class="error-message">${message}</div>
				</div>
			`;
		}
	}

	/**
	 * Clear all notifications
	 */
	static clearAll(): void {
		this.removeExistingToasts();
	}

	/**
	 * Create toast element with proper styling
	 */
	private static createToastElement(
		message: string,
		type: NotificationType,
		dismissible: boolean
	): HTMLElement {
		const toast = document.createElement("div");
		toast.className = `notification-toast toast-${type}`;

		// Add CSS if not already present
		this.ensureStyles();

		toast.innerHTML = `
			<div class="toast-content">
				<div class="toast-icon">${this.getIcon(type)}</div>
				<div class="toast-message">${message}</div>
				${
					dismissible
						? '<button class="toast-dismiss" aria-label="Dismiss">×</button>'
						: ""
				}
			</div>
		`;

		// Add dismiss functionality
		if (dismissible) {
			const dismissBtn = toast.querySelector(".toast-dismiss");
			dismissBtn?.addEventListener("click", () => this.removeToast(toast));
		}

		return toast;
	}

	/**
	 * Position toast based on specified location
	 */
	private static positionToast(toast: HTMLElement, position: string): void {
		const [vertical, horizontal] = position.split("-");

		Object.assign(toast.style, {
			position: "fixed",
			zIndex: "10000",
			[vertical]: "20px",
			[horizontal]: "20px",
		});
	}

	/**
	 * Remove a specific toast with animation
	 */
	private static removeToast(toast: HTMLElement): void {
		toast.style.animation = "slideOutRight 0.3s ease-in";
		setTimeout(() => {
			if (toast.parentNode) {
				toast.parentNode.removeChild(toast);
			}
		}, 300);
	}

	/**
	 * Remove existing toasts to prevent spam
	 */
	private static removeExistingToasts(): void {
		const existingToasts = document.querySelectorAll(".notification-toast");
		existingToasts.forEach((toast) => this.removeToast(toast as HTMLElement));
	}

	/**
	 * Get icon for notification type
	 */
	private static getIcon(type: NotificationType): string {
		const icons = {
			success: "✅",
			error: "❌",
			info: "ℹ️",
			warning: "⚠️",
		};
		return icons[type] || "ℹ️";
	}

	/**
	 * Ensure notification styles are loaded
	 */
	private static ensureStyles(): void {
		if (document.querySelector("#notification-styles")) return;

		const styles = document.createElement("style");
		styles.id = "notification-styles";
		styles.textContent = `
			.notification-toast {
				background: white;
				border-radius: 8px;
				box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
				max-width: 400px;
				min-width: 300px;
				animation: slideInRight 0.3s ease-out;
				border-left: 4px solid;
			}

			.toast-success { border-left-color: #28a745; }
			.toast-error { border-left-color: #dc3545; }
			.toast-info { border-left-color: #17a2b8; }
			.toast-warning { border-left-color: #ffc107; }

			.toast-content {
				display: flex;
				align-items: center;
				padding: 12px 16px;
				gap: 12px;
			}

			.toast-icon {
				font-size: 18px;
				flex-shrink: 0;
			}

			.toast-message {
				flex: 1;
				color: #333;
				font-weight: 500;
				line-height: 1.4;
			}

			.toast-dismiss {
				background: none;
				border: none;
				font-size: 18px;
				color: #999;
				cursor: pointer;
				padding: 0;
				width: 24px;
				height: 24px;
				display: flex;
				align-items: center;
				justify-content: center;
				border-radius: 50%;
			}

			.toast-dismiss:hover {
				background: #f5f5f5;
				color: #666;
			}

			.loading {
				text-align: center;
				padding: 3rem;
				color: #6c757d;
				font-size: 1.1rem;
			}

			.loading-spinner {
				width: 40px;
				height: 40px;
				border: 4px solid #f3f3f3;
				border-top: 4px solid #3498db;
				border-radius: 50%;
				animation: spin 1s linear infinite;
				margin: 0 auto 1rem;
			}

			.error-container {
				text-align: center;
				padding: 3rem;
				color: #dc3545;
			}

			.error-icon {
				font-size: 3rem;
				margin-bottom: 1rem;
			}

			.error-message {
				font-size: 1.1rem;
				line-height: 1.5;
			}

			@keyframes slideInRight {
				from {
					opacity: 0;
					transform: translateX(100px);
				}
				to {
					opacity: 1;
					transform: translateX(0);
				}
			}

			@keyframes slideOutRight {
				from {
					opacity: 1;
					transform: translateX(0);
				}
				to {
					opacity: 0;
					transform: translateX(100px);
				}
			}

			@keyframes spin {
				0% { transform: rotate(0deg); }
				100% { transform: rotate(360deg); }
			}
		`;

		document.head.appendChild(styles);
	}
}

/**
 * File-specific notification messages
 * Provides consistent messaging for file operations
 */
export class FileNotifications {
	/**
	 * Show file not found error with guidance
	 */
	static showFileNotFound(filename: string): void {
		NotificationService.showError(
			`📁 File not found: "${filename}" may have been moved, renamed, or deleted. Please check the file location and use "Select Files" to reload.`
		);
	}

	/**
	 * Show permission denied error
	 */
	static showPermissionDenied(filename: string): void {
		NotificationService.showError(
			`🔒 Permission denied: Cannot access "${filename}". You may need to grant permission again or the file may be locked.`
		);
	}

	/**
	 * Show no file handle error
	 */
	static showNoFileHandle(filename: string): void {
		NotificationService.showError(
			`Cannot refresh "${filename}": File was restored from storage and has no disk connection. Please use "Select Files" to reload from disk.`
		);
	}

	/**
	 * Show file refresh success
	 */
	static showRefreshSuccess(filename: string): void {
		NotificationService.showSuccess(
			`🔄 "${filename}" refreshed successfully from disk.`
		);
	}

	/**
	 * Show file save success
	 */
	static showSaveSuccess(filename: string): void {
		NotificationService.showSuccess(`"${filename}" saved successfully.`);
	}

	/**
	 * Show files loaded success
	 */
	static showFilesLoaded(count: number, filenames?: string[]): void {
		if (count === 1) {
			NotificationService.showSuccess(
				`Added "${filenames?.[0] || "file"}" to editor.`
			);
		} else {
			NotificationService.showSuccess(`Added ${count} files to editor.`);
		}
	}

	/**
	 * Show auto-refresh results
	 */
	static showAutoRefreshResults(
		refreshedCount: number,
		filenames: string[]
	): void {
		if (refreshedCount > 0) {
			NotificationService.showInfo(
				`🔄 Auto-refreshed ${refreshedCount} file(s) from disk: ${filenames.join(
					", "
				)}`
			);
		}
	}

	/**
	 * Show file removal success
	 */
	static showFileRemoved(filename: string): void {
		NotificationService.showSuccess(`File "${filename}" removed successfully.`);
	}

	/**
	 * Show files reloaded from disk success
	 */
	static showReloadFromDiskSuccess(count: number, filenames: string[]): void {
		NotificationService.showSuccess(
			`📁 Successfully reloaded ${count} file(s) from disk: ${filenames.join(
				", "
			)}`
		);
	}

	/**
	 * Show reconnect card for a file that needs permission
	 */
	static showReconnectCard(
		handle: FileSystemFileHandle,
		onReconnect: (handle: FileSystemFileHandle) => void
	): void {
		// Ensure DOM is ready
		if (document.readyState === "loading") {
			document.addEventListener("DOMContentLoaded", () => {
				this.showReconnectCard(handle, onReconnect);
			});
			return;
		}

		const reconnectId = `reconnect-${handle.name}-${Date.now()}`;

		const container = document.getElementById("reconnectCards");
		if (!container) {
			console.error(
				"Could not find editorContainer element for reconnect card"
			);
			return;
		}

		// Check if a reconnect card for this file already exists
		const existing = document.querySelector(
			`[data-reconnect-file="${handle.name}"]`
		);
		if (existing) {
			existing.remove();
		}

		const card = document.createElement("div");
		card.className = "reconnect-card";
		card.setAttribute("data-reconnect-file", handle.name);

		// Create content div
		const content = document.createElement("div");
		content.className = "reconnect-content";

		// Create elements individually to ensure they exist
		const icon = document.createElement("div");
		icon.className = "reconnect-icon";
		icon.textContent = "🔒";

		const info = document.createElement("div");
		info.className = "reconnect-info";
		info.innerHTML = `
			<h3>Permission Required</h3>
			<p>The file "<strong>${handle.name}</strong>" needs permission to be accessed. Click the button below to grant access.</p>
		`;

		const reconnectBtn = document.createElement("button");
		reconnectBtn.className = "reconnect-btn";
		reconnectBtn.id = reconnectId;
		reconnectBtn.textContent = `Grant Access to ${handle.name}`;

		const dismissBtn = document.createElement("button");
		dismissBtn.className = "dismiss-btn";
		dismissBtn.setAttribute("aria-label", "Dismiss");
		dismissBtn.textContent = "×";

		// Assemble the card
		content.appendChild(icon);
		content.appendChild(info);
		content.appendChild(reconnectBtn);
		content.appendChild(dismissBtn);
		card.appendChild(content);

		// Add styles if not already present
		this.ensureReconnectStyles();

		// Add event listeners directly to the created elements
		reconnectBtn.addEventListener("click", () => {
			onReconnect(handle);
			card.remove();
		});

		dismissBtn.addEventListener("click", () => {
			card.remove();
		});

		// Insert at the top of the container
		container.insertBefore(card, container.firstChild);
	}

	/**
	 * Ensure reconnect card styles are loaded
	 */
	private static ensureReconnectStyles(): void {
		if (document.querySelector("#reconnect-styles")) return;

		const styles = document.createElement("style");
		styles.id = "reconnect-styles";
		styles.textContent = `
			.reconnect-card {
				background: #fff3cd;
				border: 1px solid #ffeaa7;
				border-radius: 8px;
				margin: 10px 0;
				box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
				animation: slideInDown 0.3s ease-out;
			}

			.reconnect-content {
				display: flex;
				align-items: center;
				padding: 16px;
				gap: 16px;
			}

			.reconnect-icon {
				font-size: 24px;
				flex-shrink: 0;
			}

			.reconnect-info {
				flex: 1;
			}

			.reconnect-info h3 {
				margin: 0 0 8px 0;
				color: #856404;
				font-size: 16px;
			}

			.reconnect-info p {
				margin: 0;
				color: #856404;
				line-height: 1.4;
			}

			.reconnect-btn {
				background: #007bff;
				color: white;
				border: none;
				padding: 10px 16px;
				border-radius: 6px;
				cursor: pointer;
				font-weight: 500;
				white-space: nowrap;
				transition: background-color 0.2s;
			}

			.reconnect-btn:hover {
				background: #0056b3;
			}

			.dismiss-btn {
				background: none;
				border: none;
				font-size: 20px;
				color: #856404;
				cursor: pointer;
				padding: 4px;
				width: 32px;
				height: 32px;
				display: flex;
				align-items: center;
				justify-content: center;
				border-radius: 50%;
				flex-shrink: 0;
			}

			.dismiss-btn:hover {
				background: rgba(133, 100, 4, 0.1);
			}

			@keyframes slideInDown {
				from {
					opacity: 0;
					transform: translateY(-20px);
				}
				to {
					opacity: 1;
					transform: translateY(0);
				}
			}
		`;

		document.head.appendChild(styles);
	}
}
