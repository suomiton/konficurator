import { IPersistence, FileData } from "./interfaces.js";
import { ParserFactory } from "./parsers.js";
import { NotificationService } from "./ui/notifications.js";

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
			if (fileData.handle) {
				// Use existing handle if available
				const fileHandler = await import("./fileHandler.js");
				const handler = new fileHandler.FileHandler();
				await handler.writeFile(fileData.handle, serializedContent);
			} else {
				// For restored files without handles, prompt user to save
				await this.saveAsNewFile(
					fileData.name,
					serializedContent,
					fileData.type
				);
			}

			// Update in-memory content
			fileData.content = updatedData;
			// Note: originalContent should only be updated when content is reloaded from disk,
			// not when saving changes. The serializedContent here is for file output only.

			NotificationService.showSuccess(`Successfully saved ${fileData.name}`);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			NotificationService.showError(
				`Failed to save ${fileData.name}: ${message}`
			);
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
	 * Saves file with new handle when original handle is not available
	 */
	private async saveAsNewFile(
		originalName: string,
		content: string,
		fileType: "json" | "xml" | "config"
	): Promise<void> {
		try {
			// Use showSaveFilePicker to let user choose save location
			const fileHandle = await window.showSaveFilePicker({
				suggestedName: originalName,
				types: [
					{
						description: `${fileType.toUpperCase()} files`,
						accept:
							fileType === "xml"
								? { "application/xml": [".xml"] }
								: fileType === "config"
								? { "text/plain": [".config"] }
								: { "application/json": [".json"] },
					},
				],
			});

			// Write content to the new file
			const writable = await fileHandle.createWritable();
			await writable.write(content);
			await writable.close();
		} catch (error) {
			if (error instanceof Error && error.name === "AbortError") {
				throw new Error("Save operation was cancelled");
			}
			throw error;
		}
	}
}
