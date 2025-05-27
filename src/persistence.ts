import { IPersistence, FileData } from "./interfaces.js";
import { ParserFactory } from "./parsers.js";

/**
 * Persistence Module
 * Handles saving form data back to files
 * Follows Single Responsibility Principle and Dependency Inversion Principle
 */
export class FilePersistence implements IPersistence {
	/**
	 * Saves file with updated form data
	 */
	async saveFile(
		fileData: FileData,
		formElement: HTMLFormElement
	): Promise<void> {
		try {
			// Extract form data
			const updatedData = this.extractFormData(formElement, fileData.content);

			// Get appropriate parser for serialization
			const parser = ParserFactory.createParser(fileData.type);

			// Serialize data to string
			const serializedContent = parser.serialize(updatedData);

			// Write to file
			const fileHandler = await import("./fileHandler.js");
			const handler = new fileHandler.FileHandler();
			await handler.writeFile(fileData.handle, serializedContent);

			// Update in-memory content
			fileData.content = updatedData;

			this.showSuccessMessage(fileData.name);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			this.showErrorMessage(`Failed to save ${fileData.name}: ${message}`);
			throw error;
		}
	}

	/**
	 * Extracts data from form and builds object structure
	 */
	private extractFormData(
		formElement: HTMLFormElement,
		originalData: any
	): any {
		const formData = new FormData(formElement);
		const result = this.deepClone(originalData);

		// Process each form field
		for (const [path, value] of formData.entries()) {
			this.setNestedValue(result, path, value);
		}

		// Handle checkboxes (unchecked boxes don't appear in FormData)
		const checkboxes = formElement.querySelectorAll('input[type="checkbox"]');
		checkboxes.forEach((element) => {
			const checkbox = element as HTMLInputElement;
			const path = checkbox.name;
			const isChecked = checkbox.checked;
			this.setNestedValue(result, path, isChecked);
		});

		// Handle arrays (textareas with data-type="array")
		const arrayFields = formElement.querySelectorAll(
			'textarea[data-type="array"]'
		);
		arrayFields.forEach((element) => {
			const textarea = element as HTMLTextAreaElement;
			const path = textarea.name;
			try {
				const arrayValue = JSON.parse(textarea.value);
				this.setNestedValue(result, path, arrayValue);
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Unknown error";
				throw new Error(`Invalid array format in field "${path}": ${message}`);
			}
		});

		return result;
	}

	/**
	 * Sets a nested value in an object using dot notation path
	 */
	private setNestedValue(obj: any, path: string, value: any): void {
		const keys = path.split(".");
		let current = obj;

		// Navigate to the parent object
		for (let i = 0; i < keys.length - 1; i++) {
			const key = keys[i];
			if (!(key in current) || typeof current[key] !== "object") {
				current[key] = {};
			}
			current = current[key];
		}

		// Set the final value with type conversion
		const finalKey = keys[keys.length - 1];
		current[finalKey] = this.convertValue(value, current[finalKey]);
	}

	/**
	 * Converts form value to appropriate type based on original value
	 */
	private convertValue(formValue: any, originalValue: any): any {
		// If it's a FormData value (string), convert it appropriately
		if (typeof formValue === "string") {
			// Check original type to determine conversion
			if (typeof originalValue === "number") {
				const numValue = Number(formValue);
				return isNaN(numValue) ? formValue : numValue;
			}

			if (typeof originalValue === "boolean") {
				return formValue === "true" || formValue === "on";
			}

			// String values
			return formValue;
		}

		// For non-string values (like boolean from checkbox), return as-is
		return formValue;
	}

	/**
	 * Deep clones an object to avoid mutating original data
	 */
	private deepClone(obj: any): any {
		if (obj === null || typeof obj !== "object") {
			return obj;
		}

		if (Array.isArray(obj)) {
			return obj.map((item) => this.deepClone(item));
		}

		const cloned: any = {};
		for (const key in obj) {
			if (obj.hasOwnProperty(key)) {
				cloned[key] = this.deepClone(obj[key]);
			}
		}

		return cloned;
	}

	/**
	 * Shows success message to user
	 */
	private showSuccessMessage(filename: string): void {
		this.showMessage(`✅ Successfully saved ${filename}`, "success");
	}

	/**
	 * Shows error message to user
	 */
	private showErrorMessage(message: string): void {
		this.showMessage(`❌ ${message}`, "error");
	}

	/**
	 * Generic message display function
	 */
	private showMessage(message: string, type: "success" | "error"): void {
		// Remove existing messages
		const existingMessages = document.querySelectorAll(".message-toast");
		existingMessages.forEach((msg) => msg.remove());

		// Create new message
		const messageDiv = document.createElement("div");
		messageDiv.className = `message-toast ${type}`;
		messageDiv.textContent = message;
		messageDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 1000;
            background: ${type === "success" ? "#28a745" : "#dc3545"};
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            animation: slideIn 0.3s ease-out;
        `;

		// Add CSS animation
		if (!document.querySelector("#toast-styles")) {
			const styles = document.createElement("style");
			styles.id = "toast-styles";
			styles.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOut {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
			document.head.appendChild(styles);
		}

		document.body.appendChild(messageDiv);

		// Auto-remove after 3 seconds
		setTimeout(() => {
			messageDiv.style.animation = "slideOut 0.3s ease-in";
			setTimeout(() => messageDiv.remove(), 300);
		}, 3000);
	}
}
