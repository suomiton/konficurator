/**
 * Event Handler Module - Pure functions for setting up form event handlers
 * Separates event handling logic from DOM creation
 */

import { FormFieldData } from "./form-data";

export interface FormEventHandlers {
	onFieldChange?: (path: string, value: any, fieldType: string) => void;
	onArrayItemAdd?: (path: string) => void;
	onArrayItemRemove?: (path: string, index: number) => void;
	onFileRemove?: (fileName: string) => void;
	onFileRefresh?: (fileName: string) => void;
	onFileReload?: (fileName: string) => void;
	onFileSave?: (fileName: string) => void;
}

/**
 * Sets up event listeners for a form field element
 */
export function setupFieldEventListeners(
	element: HTMLElement,
	fieldData: FormFieldData,
	handlers: FormEventHandlers
): void {
	const { onFieldChange } = handlers;
	if (!onFieldChange) return;

	switch (fieldData.type) {
		case "text":
		case "number":
			setupInputEventListeners(element, fieldData, onFieldChange);
			break;
		case "boolean":
			setupCheckboxEventListeners(element, fieldData, onFieldChange);
			break;
		case "xml-value":
			setupTextareaEventListeners(element, fieldData, onFieldChange);
			break;
		case "array":
			setupArrayEventListeners(element, fieldData, handlers);
			break;
		default:
			// Handle other field types as needed
			break;
	}
}

/**
 * Sets up event listeners for text/number input fields
 */
function setupInputEventListeners(
	element: HTMLElement,
	fieldData: FormFieldData,
	onFieldChange: (path: string, value: any, fieldType: string) => void
): void {
	const input = element.querySelector("input") as HTMLInputElement;
	if (!input) return;

	// Handle input changes with debouncing for better performance
	let timeoutId: NodeJS.Timeout;

	input.addEventListener("input", () => {
		clearTimeout(timeoutId);
		timeoutId = setTimeout(() => {
			const value =
				fieldData.type === "number"
					? input.value
						? parseFloat(input.value)
						: ""
					: input.value;
			onFieldChange(fieldData.path, value, fieldData.type);
		}, 300); // 300ms debounce
	});

	// Handle immediate changes on blur for better UX
	input.addEventListener("blur", () => {
		clearTimeout(timeoutId);
		const value =
			fieldData.type === "number"
				? input.value
					? parseFloat(input.value)
					: ""
				: input.value;
		onFieldChange(fieldData.path, value, fieldData.type);
	});
}

/**
 * Sets up event listeners for checkbox fields
 */
function setupCheckboxEventListeners(
	element: HTMLElement,
	fieldData: FormFieldData,
	onFieldChange: (path: string, value: any, fieldType: string) => void
): void {
	const checkbox = element.querySelector(
		'input[type="checkbox"]'
	) as HTMLInputElement;
	if (!checkbox) return;

	checkbox.addEventListener("change", () => {
		onFieldChange(fieldData.path, checkbox.checked, fieldData.type);
	});
}

/**
 * Sets up event listeners for textarea fields (XML values)
 */
function setupTextareaEventListeners(
	element: HTMLElement,
	fieldData: FormFieldData,
	onFieldChange: (path: string, value: any, fieldType: string) => void
): void {
	const textarea = element.querySelector("textarea") as HTMLTextAreaElement;
	if (!textarea) return;

	let timeoutId: NodeJS.Timeout;

	textarea.addEventListener("input", () => {
		clearTimeout(timeoutId);
		timeoutId = setTimeout(() => {
			onFieldChange(fieldData.path, textarea.value, fieldData.type);
		}, 300);
	});

	textarea.addEventListener("blur", () => {
		clearTimeout(timeoutId);
		onFieldChange(fieldData.path, textarea.value, fieldData.type);
	});
}

/**
 * Sets up event listeners for array fields
 */
function setupArrayEventListeners(
	element: HTMLElement,
	fieldData: FormFieldData,
	handlers: FormEventHandlers
): void {
	const { onArrayItemAdd, onArrayItemRemove } = handlers;

	// Add item button
	const addButton = element.querySelector(
		".add-array-item"
	) as HTMLButtonElement;
	if (addButton && onArrayItemAdd) {
		addButton.addEventListener("click", () => {
			onArrayItemAdd(fieldData.path);
		});
	}

	// Remove item buttons (delegated event handling)
	if (onArrayItemRemove) {
		element.addEventListener("click", (e) => {
			const target = e.target as HTMLElement;
			if (target.classList.contains("remove-array-item")) {
				const index = parseInt(target.getAttribute("data-index") || "0", 10);
				onArrayItemRemove(fieldData.path, index);
			}
		});
	}
}

/**
 * Sets up event listeners for file action buttons
 */
export function setupFileActionEventListeners(
	headerElement: HTMLElement,
	fileName: string,
	handlers: FormEventHandlers
): void {
	const { onFileRemove, onFileRefresh, onFileReload } = handlers;

	// Remove file button
	const removeButton = headerElement.querySelector(
		".remove-file-btn"
	) as HTMLButtonElement;
	if (removeButton && onFileRemove) {
		removeButton.addEventListener("click", () => {
			onFileRemove(fileName);
		});
	}

	// Refresh file button
	const refreshButton = headerElement.querySelector(
		".refresh-file-btn"
	) as HTMLButtonElement;
	if (refreshButton && onFileRefresh) {
		refreshButton.addEventListener("click", () => {
			onFileRefresh(fileName);
		});
	}

	// Reload from disk button
	const reloadButton = headerElement.querySelector(
		".reload-from-disk-btn"
	) as HTMLButtonElement;
	if (reloadButton && onFileReload) {
		reloadButton.addEventListener("click", () => {
			onFileReload(fileName);
		});
	}
}

/**
 * Sets up event listeners for save button
 */
export function setupSaveEventListeners(
	saveContainer: HTMLElement,
	fileName: string,
	handlers: FormEventHandlers
): void {
	const { onFileSave } = handlers;
	if (!onFileSave) return;

	const saveButton = saveContainer.querySelector("button") as HTMLButtonElement;
	if (saveButton) {
		saveButton.addEventListener("click", () => {
			onFileSave(fileName);
		});
	}
}

/**
 * Sets up form submit prevention (since we handle changes via individual field events)
 */
export function setupFormEventListeners(formElement: HTMLElement): void {
	if (formElement.tagName.toLowerCase() === "form") {
		formElement.addEventListener("submit", (e) => {
			e.preventDefault();
		});
	}
}

/**
 * Utility function to remove all event listeners from an element
 * Useful for cleanup when re-rendering components
 */
export function removeAllEventListeners(element: HTMLElement): HTMLElement {
	// Clone the element to remove all event listeners
	const newElement = element.cloneNode(true) as HTMLElement;
	element.parentNode?.replaceChild(newElement, element);
	return newElement;
}

/**
 * Utility function to get field value from DOM element
 */
export function getFieldValueFromElement(
	element: HTMLElement,
	fieldType: string
): any {
	switch (fieldType) {
		case "boolean": {
			const checkbox = element.querySelector(
				'input[type="checkbox"]'
			) as HTMLInputElement;
			return checkbox ? checkbox.checked : false;
		}
		case "number": {
			const input = element.querySelector(
				'input[type="number"]'
			) as HTMLInputElement;
			return input && input.value ? parseFloat(input.value) : "";
		}
		case "xml-value": {
			const textarea = element.querySelector("textarea") as HTMLTextAreaElement;
			return textarea ? textarea.value : "";
		}
		default: {
			const input = element.querySelector("input") as HTMLInputElement;
			return input ? input.value : "";
		}
	}
}

/**
 * Utility function to set field value in DOM element
 */
export function setFieldValueInElement(
	element: HTMLElement,
	fieldType: string,
	value: any
): void {
	const stringValue =
		value === null
			? "null"
			: value === undefined
			? "undefined"
			: String(value || "");

	switch (fieldType) {
		case "boolean": {
			const checkbox = element.querySelector(
				'input[type="checkbox"]'
			) as HTMLInputElement;
			if (checkbox) checkbox.checked = Boolean(value);
			break;
		}
		case "number": {
			const input = element.querySelector(
				'input[type="number"]'
			) as HTMLInputElement;
			if (input) input.value = stringValue;
			break;
		}
		case "xml-value": {
			const textarea = element.querySelector("textarea") as HTMLTextAreaElement;
			if (textarea) textarea.value = stringValue;
			break;
		}
		default: {
			const input = element.querySelector("input") as HTMLInputElement;
			if (input) input.value = stringValue;
			break;
		}
	}
}
