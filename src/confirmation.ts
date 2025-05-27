/**
 * Confirmation Dialog Utility
 * Provides consistent confirmation dialogs throughout the application
 */
export class ConfirmationDialog {
	/**
	 * Show a confirmation dialog with custom message
	 */
	static async show(
		title: string,
		message: string,
		confirmText: string = "Confirm",
		cancelText: string = "Cancel"
	): Promise<boolean> {
		return new Promise((resolve) => {
			const overlay = this.createOverlay();
			const dialog = this.createDialog(title, message, confirmText, cancelText);

			// Handle confirm
			const confirmBtn = dialog.querySelector(
				".confirm-btn"
			) as HTMLButtonElement;
			const cancelBtn = dialog.querySelector(
				".cancel-btn"
			) as HTMLButtonElement;

			confirmBtn.addEventListener("click", () => {
				overlay.remove();
				resolve(true);
			});

			cancelBtn.addEventListener("click", () => {
				overlay.remove();
				resolve(false);
			});

			// Handle escape key
			const handleEscape = (e: KeyboardEvent) => {
				if (e.key === "Escape") {
					overlay.remove();
					document.removeEventListener("keydown", handleEscape);
					resolve(false);
				}
			};
			document.addEventListener("keydown", handleEscape);

			// Handle overlay click
			overlay.addEventListener("click", (e) => {
				if (e.target === overlay) {
					overlay.remove();
					resolve(false);
				}
			});

			overlay.appendChild(dialog);
			document.body.appendChild(overlay);

			// Focus confirm button
			setTimeout(() => confirmBtn.focus(), 100);
		});
	}

	/**
	 * Create overlay element
	 */
	private static createOverlay(): HTMLElement {
		const overlay = document.createElement("div");
		overlay.className = "confirmation-overlay";
		overlay.style.cssText = `
			position: fixed;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			background: rgba(0, 0, 0, 0.5);
			display: flex;
			align-items: center;
			justify-content: center;
			z-index: 1000;
			animation: fadeIn 0.2s ease-in-out;
		`;
		return overlay;
	}

	/**
	 * Create dialog element
	 */
	private static createDialog(
		title: string,
		message: string,
		confirmText: string,
		cancelText: string
	): HTMLElement {
		const dialog = document.createElement("div");
		dialog.className = "confirmation-dialog";
		dialog.style.cssText = `
			background: white;
			border-radius: 8px;
			padding: 24px;
			max-width: 400px;
			margin: 20px;
			box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
			animation: slideIn 0.3s ease-out;
		`;

		dialog.innerHTML = `
			<h3 style="margin: 0 0 16px 0; color: #333; font-size: 18px;">${title}</h3>
			<p style="margin: 0 0 24px 0; color: #666; line-height: 1.5;">${message}</p>
			<div style="display: flex; gap: 12px; justify-content: flex-end;">
				<button class="cancel-btn" style="
					padding: 8px 16px;
					border: 1px solid #ddd;
					background: white;
					border-radius: 4px;
					cursor: pointer;
					font-size: 14px;
				">${cancelText}</button>
				<button class="confirm-btn" style="
					padding: 8px 16px;
					border: none;
					background: #e74c3c;
					color: white;
					border-radius: 4px;
					cursor: pointer;
					font-size: 14px;
				">${confirmText}</button>
			</div>
		`;

		// Add hover effects
		const confirmBtn = dialog.querySelector(
			".confirm-btn"
		) as HTMLButtonElement;
		const cancelBtn = dialog.querySelector(".cancel-btn") as HTMLButtonElement;

		confirmBtn.addEventListener("mouseenter", () => {
			confirmBtn.style.background = "#c0392b";
		});
		confirmBtn.addEventListener("mouseleave", () => {
			confirmBtn.style.background = "#e74c3c";
		});

		cancelBtn.addEventListener("mouseenter", () => {
			cancelBtn.style.background = "#f5f5f5";
		});
		cancelBtn.addEventListener("mouseleave", () => {
			cancelBtn.style.background = "white";
		});

		return dialog;
	}
}
