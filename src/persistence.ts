import { IPersistence, FileData } from "./interfaces.js";
import { ParserFactory } from "./parsers.js";
import { NotificationService } from "./ui/notifications.js";

// Import WASM parser for non-destructive updates
import init, { update_value } from "../parser-wasm/pkg/parser_core.js";

/**
 * Persistence Module
 * Handles saving form data back to files using WASM non-destructive updates
 * Follows Single Responsibility Principle and Dependency Inversion Principle
 */
export class FilePersistence implements IPersistence {
	private wasmInitialized = false;

	/**
	 * Initialize WASM module if not already done
	 */
	private async ensureWasmInitialized(): Promise<void> {
		if (!this.wasmInitialized) {
			await init();
			this.wasmInitialized = true;
		}
	}

	/**
	 * Saves file with updated form data using WASM non-destructive updates
	 */
	async saveFile(
		fileData: FileData,
		formElement: HTMLFormElement
	): Promise<void> {
		try {
			// Ensure WASM module is initialized
			await this.ensureWasmInitialized();

			// Get original file content as baseline
			let updatedContent = fileData.originalContent || "";

			// Extract form changes and apply them using WASM updates
			const fieldChanges = this.extractFieldChanges(
				formElement,
				fileData.content
			);

			// Debug: log field changes and content before WASM update
			console.debug("[FilePersistence] File info:", {
				name: fileData.name,
				type: fileData.type,
				hasHandle: !!fileData.handle,
			});
			console.debug("[FilePersistence] fieldChanges:", fieldChanges);
			console.debug(
				"[FilePersistence] originalContent type:",
				typeof updatedContent
			);
			console.debug(
				"[FilePersistence] originalContent preview:",
				updatedContent.substring(0, 200) + "..."
			);
			console.debug(
				"[FilePersistence] parsed content structure:",
				fileData.content
			);
			console.debug(
				"[FilePersistence] Original data keys:",
				Object.keys(fileData.content || {})
			);
			// Apply each change using WASM update_value for non-destructive editing
			for (const change of fieldChanges) {
				try {
					console.debug("[FilePersistence] WASM call:", {
						fileType: fileData.type,
						path: change.path,
						newValue: change.newValue,
						contentPreview: updatedContent.substring(0, 100) + "...",
						contentLength: updatedContent.length,
					});

					// Validate JSON before passing to WASM
					try {
						JSON.parse(updatedContent);
						console.debug("[FilePersistence] JSON validation: VALID");
					} catch (e) {
						console.error("[FilePersistence] JSON validation: INVALID", e);
					}

					// Check if the path exists in the parsed JSON
					try {
						const parsed = JSON.parse(updatedContent);
						let current = parsed;
						let pathSoFar = [];
						for (const key of change.path) {
							pathSoFar.push(key);
							if (current && typeof current === "object" && key in current) {
								current = current[key];
								console.debug(
									`[FilePersistence] Path ${pathSoFar.join(
										"."
									)} exists, value:`,
									current
								);
							} else {
								console.error(
									`[FilePersistence] Path ${pathSoFar.join(".")} NOT FOUND in`,
									current
								);
								break;
							}
						}
					} catch (e) {
						console.error("[FilePersistence] Error validating path:", e);
					}

					updatedContent = update_value(
						fileData.type,
						updatedContent,
						change.path,
						change.newValue
					);
				} catch (error) {
					// Surface the actual error message from WASM, if available
					const message =
						error instanceof Error
							? error.message
							: typeof error === "string"
							? error
							: JSON.stringify(error);
					NotificationService.showError(
						`Failed to update field "${change.path.join(".")}" with value "${
							change.newValue
						}": ${message}`
					);
					throw new Error(
						`Failed to update field "${change.path.join(".")}" with value "${
							change.newValue
						}": ${message}`
					);
				}
			}

			// Write to file
			if (fileData.handle) {
				// Use existing handle if available
				const fileHandler = await import("./fileHandler.js");
				const handler = new fileHandler.FileHandler();
				await handler.writeFile(fileData.handle, updatedContent);
			} else {
				// For restored files without handles, prompt user to save
				await this.saveAsNewFile(fileData.name, updatedContent, fileData.type);
			}

			// Update in-memory content - re-parse to maintain data structure consistency
			const parser = ParserFactory.createParser(fileData.type, updatedContent);
			fileData.content = parser.parse(updatedContent);
			// Update originalContent to the new file content for future edits
			fileData.originalContent = updatedContent;

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
	 * Extracts field changes from form compared to original data
	 */
	private extractFieldChanges(
		formElement: HTMLFormElement,
		originalData: any
	): Array<{ path: string[]; newValue: string }> {
		const changes: Array<{ path: string[]; newValue: string }> = [];
		const formData = new FormData(formElement);

		// Debug: Log the form structure
		console.debug("[FilePersistence] Form element:", formElement);
		console.debug(
			"[FilePersistence] Form innerHTML preview:",
			formElement.innerHTML.substring(0, 500)
		);

		const allArrayElements = formElement.querySelectorAll(".array-field");
		console.debug(
			"[FilePersistence] All elements with class 'array-field':",
			allArrayElements.length
		);
		allArrayElements.forEach((el, idx) => {
			const element = el as HTMLElement;
			console.debug(`[FilePersistence] Array element ${idx}:`, {
				className: element.className,
				dataType: element.getAttribute("data-type"),
				dataPath: element.getAttribute("data-path"),
				hasArrayInputs: element.querySelectorAll(".array-item-input").length,
			});
		});

		console.debug(
			"[FilePersistence] All elements with data-type attribute:",
			formElement.querySelectorAll("[data-type]")
		);

		// Process each form field
		for (const [fieldPath, value] of formData.entries()) {
			const path = fieldPath.split(".");
			const currentValue = this.getNestedValue(originalData, path);
			const newValue = this.convertFormValueToString(value, currentValue);

			console.debug("[FilePersistence] Processing field:", {
				fieldPath,
				path,
				currentValue,
				newValue,
				hasChanged: this.hasValueChanged(currentValue, newValue),
			});

			if (this.hasValueChanged(currentValue, newValue)) {
				changes.push({
					path,
					newValue,
				});
			}
		}

		// Handle checkboxes (unchecked boxes don't appear in FormData)
		const checkboxes = formElement.querySelectorAll('input[type="checkbox"]');
		checkboxes.forEach((element) => {
			const checkbox = element as HTMLInputElement;
			const fieldPath = checkbox.name;
			const path = fieldPath.split(".");
			const currentValue = this.getNestedValue(originalData, path);
			const newValue = checkbox.checked ? "true" : "false";

			if (this.hasValueChanged(currentValue, newValue)) {
				changes.push({
					path,
					newValue,
				});
			}
		});

		// Handle arrays (textareas with data-type="array")
		const arrayFields = formElement.querySelectorAll(
			'textarea[data-type="array"]'
		);
		arrayFields.forEach((element) => {
			const textarea = element as HTMLTextAreaElement;
			const fieldPath = textarea.name;
			const path = fieldPath.split(".");
			const currentValue = this.getNestedValue(originalData, path);

			try {
				// For arrays, we need to serialize the entire array as JSON
				const arrayValue = JSON.parse(textarea.value);
				const newValue = JSON.stringify(arrayValue);

				if (this.hasValueChanged(currentValue, arrayValue)) {
					changes.push({
						path,
						newValue,
					});
				}
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Unknown error";
				throw new Error(
					`Invalid array format in field "${fieldPath}": ${message}`
				);
			}
		});

		// Handle modern array fields (individual input fields within .array-field containers)
		const allArrayFields = formElement.querySelectorAll(".array-field");
		console.debug(
			"[FilePersistence] Checking all .array-field elements:",
			allArrayFields.length
		);
		allArrayFields.forEach((element, index) => {
			const el = element as HTMLElement;
			console.debug(`[FilePersistence] Array field ${index}:`, {
				className: el.className,
				dataType: el.getAttribute("data-type"),
				dataPath: el.getAttribute("data-path"),
				innerHTML: el.innerHTML.substring(0, 200),
			});
		});

		// Process all array fields, not just those with specific data-type
		allArrayFields.forEach((arrayContainer) => {
			const element = arrayContainer as HTMLElement;
			const fieldPath = element.getAttribute("data-path");
			if (!fieldPath) return;

			const path = fieldPath.split(".");
			const currentValue = this.getNestedValue(originalData, path);

			// Also try to get original value from the element itself
			const originalValueAttr = element.getAttribute("data-original-value");
			let originalArrayValue: any[] = [];
			if (originalValueAttr) {
				try {
					originalArrayValue = JSON.parse(originalValueAttr);
				} catch (e) {
					console.warn(
						"[FilePersistence] Failed to parse original array value:",
						originalValueAttr
					);
					originalArrayValue = Array.isArray(currentValue) ? currentValue : [];
				}
			} else {
				originalArrayValue = Array.isArray(currentValue) ? currentValue : [];
			}

			// Collect all array item inputs
			const arrayItemInputs = element.querySelectorAll(".array-item-input");
			const newArrayValue: string[] = [];

			arrayItemInputs.forEach((input) => {
				const inputElement = input as HTMLInputElement;
				newArrayValue.push(inputElement.value);
			});

			console.debug("[FilePersistence] Processing array field:", {
				fieldPath,
				path,
				currentValue,
				currentValueType: typeof currentValue,
				currentValueIsArray: Array.isArray(currentValue),
				originalArrayValue,
				newArrayValue,
				newArrayValueType: typeof newArrayValue,
				arrayItemInputsCount: arrayItemInputs.length,
				hasChanged: this.hasArrayChanged(originalArrayValue, newArrayValue),
			});

			// Detailed comparison logging
			if (Array.isArray(originalArrayValue)) {
				console.debug("[FilePersistence] Array comparison details:", {
					originalLength: originalArrayValue.length,
					newLength: newArrayValue.length,
					originalItems: originalArrayValue,
					newItems: newArrayValue,
					itemComparisons: originalArrayValue.map((item, i) => ({
						index: i,
						original: item,
						new: newArrayValue[i],
						originalStr: String(item),
						newStr: String(newArrayValue[i]),
						equal: String(item) === String(newArrayValue[i]),
					})),
				});
			}

			if (this.hasArrayChanged(originalArrayValue, newArrayValue)) {
				changes.push({
					path,
					newValue: JSON.stringify(newArrayValue),
				});
			}
		});

		return changes;
	}

	/**
	 * Gets a nested value from an object using dot notation path
	 */
	private getNestedValue(obj: any, path: string[]): any {
		let current = obj;
		for (const key of path) {
			if (current == null || typeof current !== "object") {
				return undefined;
			}
			current = current[key];
		}
		return current;
	}

	/**
	 * Converts form value to string representation for WASM
	 */
	private convertFormValueToString(formValue: any, originalValue: any): string {
		// If it's already a string from form, use it directly
		if (typeof formValue === "string") {
			// Convert based on original type
			if (typeof originalValue === "number") {
				const numValue = Number(formValue);
				return isNaN(numValue) ? formValue : numValue.toString();
			}

			if (typeof originalValue === "boolean") {
				return formValue === "true" || formValue === "on" ? "true" : "false";
			}

			return formValue;
		}

		// For non-string values, convert to string
		return String(formValue);
	}

	/**
	 * Checks if a value has changed compared to original
	 */
	private hasValueChanged(originalValue: any, newValue: any): boolean {
		// Convert both to strings for comparison
		const originalStr =
			originalValue === null || originalValue === undefined
				? ""
				: String(originalValue);
		const newStr = String(newValue);

		return originalStr !== newStr;
	}

	/**
	 * Checks if an array has changed compared to original
	 */
	private hasArrayChanged(originalValue: any, newValue: any[]): boolean {
		// If original is not an array, treat it as empty array
		const originalArray = Array.isArray(originalValue) ? originalValue : [];

		// Compare lengths first
		if (originalArray.length !== newValue.length) {
			return true;
		}

		// Compare each item
		for (let i = 0; i < originalArray.length; i++) {
			if (String(originalArray[i]) !== String(newValue[i])) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Saves file with new handle when original handle is not available
	 */
	private async saveAsNewFile(
		originalName: string,
		content: string,
		fileType: "json" | "xml" | "config" | "env"
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
								: fileType === "env"
								? { "text/plain": [".env"] }
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
