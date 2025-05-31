/**
 * Confirmation Dialog Utility
 * Provides consistent confirmation dialogs throughout the application
 */

import { createElement, createButton } from "./ui/dom-factory.js";

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
		return createElement({
			tag: "div",
			className: "confirmation-overlay",
		});
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
		const dialog = createElement({
			tag: "div",
			className: "confirmation-dialog",
		});

		const titleElement = createElement({
			tag: "h3",
			textContent: title,
		});

		const messageElement = createElement({
			tag: "p",
			textContent: message,
		});

		const buttonsContainer = createElement({
			tag: "div",
			className: "confirmation-buttons",
		});

		const cancelBtn = createButton({
			tag: "button",
			className: "cancel-btn",
			textContent: cancelText,
		});

		const confirmBtn = createButton({
			tag: "button",
			className: "confirm-btn",
			textContent: confirmText,
		});

		buttonsContainer.appendChild(cancelBtn);
		buttonsContainer.appendChild(confirmBtn);

		dialog.appendChild(titleElement);
		dialog.appendChild(messageElement);
		dialog.appendChild(buttonsContainer);

		return dialog;
	}
}
