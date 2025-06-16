/**
 * DOM Renderer Module - Uses DOM factory to create form elements from form data
 * Focuses on DOM creation without business logic
 */

import {
	createElement,
	createInput,
	createButton,
	createForm,
	createTextarea,
	createLabel,
} from "./dom-factory.js";
import {
	FormFieldData,
	TextFieldData,
	NumberFieldData,
	BooleanFieldData,
} from "./form-data.js";

export interface FormElementRenderOptions {
	showLabels?: boolean;
	labelPosition?: "above" | "before" | "after";
	fieldClassName?: string;
	inputClassName?: string;
	labelClassName?: string;
}

/**
 * Renders a complete form group with label and input
 */
export function renderFormField(
	fieldData: FormFieldData,
	options: FormElementRenderOptions = {}
): HTMLElement {
	const {
		showLabels = true,
		labelPosition = "above",
		fieldClassName = "form-group",
		inputClassName = "form-control",
		labelClassName = "form-label",
	} = options;

	const formGroup = createElement({
		tag: "div",
		className: fieldClassName,
	});

	// Only show label for non-object/array fields
	let label: HTMLElement | null = null;
	const suppressLabel =
		fieldData.type === "object" || fieldData.type === "array";
	if (showLabels && !suppressLabel) {
		label = createLabel({
			tag: "label",
			className: labelClassName,
			textContent: fieldData.label,
			attributes: { for: fieldData.path },
		});
	}

	// Create input based on field type
	const input = renderInputElement(fieldData, inputClassName);

	// Arrange elements based on label position
	if (label) {
		if (labelPosition === "above" || labelPosition === "before") {
			formGroup.appendChild(label);
			formGroup.appendChild(input);
		} else {
			formGroup.appendChild(input);
			formGroup.appendChild(label);
		}
	} else {
		formGroup.appendChild(input);
	}

	return formGroup;
}

/**
 * Renders just the input element based on field type
 */
export function renderInputElement(
	fieldData: FormFieldData,
	className: string = "form-control"
): HTMLElement {
	switch (fieldData.type) {
		case "text":
			return renderTextInput(fieldData as TextFieldData, className);
		case "number":
			return renderNumberInput(fieldData as NumberFieldData, className);
		case "boolean":
			return renderBooleanInput(fieldData as BooleanFieldData, className);
		case "object":
			return renderObjectField(fieldData, className);
		case "array":
			return renderArrayField(fieldData, className);
		case "xml-heading":
			return renderXmlHeadingField(fieldData, className);
		case "xml-value":
			return renderXmlValueField(fieldData, className);
		case "xml-attributes":
			return renderXmlAttributesField(fieldData, className);
		default:
			return renderTextInput(fieldData as TextFieldData, className);
	}
}

/**
 * Renders text input field
 */
function renderTextInput(
	fieldData: TextFieldData,
	className: string
): HTMLElement {
	return createInput({
		tag: "input",
		className,
		type: fieldData.inputType || "text",
		name: fieldData.path,
		id: fieldData.path,
		value: String(fieldData.value || ""),
		data: { path: fieldData.path },
	});
}

/**
 * Renders number input field
 */
function renderNumberInput(
	fieldData: NumberFieldData,
	className: string
): HTMLElement {
	const attributes: Record<string, string> = {};
	if (fieldData.min !== undefined) attributes.min = String(fieldData.min);
	if (fieldData.max !== undefined) attributes.max = String(fieldData.max);
	if (fieldData.step !== undefined) attributes.step = String(fieldData.step);

	return createInput({
		tag: "input",
		className,
		type: "number",
		name: fieldData.path,
		id: fieldData.path,
		value: String(fieldData.value || ""),
		attributes,
		data: { path: fieldData.path },
	});
}

/**
 * Renders boolean checkbox input
 */
function renderBooleanInput(
	fieldData: BooleanFieldData,
	className: string
): HTMLElement {
	return createInput({
		tag: "input",
		className: `${className} checkbox-input`,
		type: "checkbox",
		name: fieldData.path,
		id: fieldData.path,
		checked: Boolean(fieldData.value),
		data: { path: fieldData.path },
	});
}

/**
 * Renders object field (nested form container)
 */
function renderObjectField(
	fieldData: FormFieldData,
	className: string
): HTMLElement {
	const container = createElement({
		tag: "div",
		className: `${className} object-field`,
		data: { path: fieldData.path, type: "object" },
	});

	const header = createElement({
		tag: "div",
		className: "object-header",
		innerHTML: `<strong>${fieldData.label}</strong>`,
	});

	const fieldsContainer = createElement({
		tag: "div",
		className: "object-fields",
		data: { path: fieldData.path },
	});

	container.appendChild(header);
	container.appendChild(fieldsContainer);

	return container;
}

/**
 * Renders array field (list container)
 */
function renderArrayField(
	fieldData: FormFieldData,
	className: string
): HTMLElement {
	const container = createElement({
		tag: "div",
		className: `${className} array-field`,
		data: { path: fieldData.path, type: "array" },
	});

	const header = createElement({
		tag: "div",
		className: "array-header",
		innerHTML: `<strong>${fieldData.label}</strong>`,
	});

	// Only one items container, no extra .array-items-list
	const itemsContainer = createElement({
		tag: "div",
		className: "array-items",
		data: { path: fieldData.path },
	});

	const addButton = createButton({
		tag: "button",
		className: "btn btn-primary btn-small add-array-item",
		type: "button",
		textContent: "+ Add Item",
		data: { path: fieldData.path },
	});

	function renderItems(items: any[]) {
		itemsContainer.innerHTML = "";
		items.forEach((item, idx) => {
			const itemContainer = createElement({
				tag: "div",
				className: "array-item-container",
			});

			const label = createElement({
				tag: "div",
				className: "array-item-label",
				textContent: `Item${idx}`,
			});

			const input = createInput({
				tag: "input",
				className: "form-control array-item-input",
				type: "text",
				value: String(item),
				data: { idx: String(idx) },
			});
			input.addEventListener("input", (e) => {
				(fieldData as any).items[idx] = (e.target as HTMLInputElement).value;
			});

			const removeBtn = createButton({
				tag: "button",
				className: "btn btn-danger btn-small remove-array-item",
				type: "button",
				textContent: "×",
				data: { idx: String(idx) },
			});
			removeBtn.addEventListener("click", () => {
				(fieldData as any).items.splice(idx, 1);
				renderItems((fieldData as any).items);
			});

			itemContainer.appendChild(label);
			itemContainer.appendChild(input);
			itemContainer.appendChild(removeBtn);
			itemsContainer.appendChild(itemContainer);
		});
	}

	// Initial render
	if (!(fieldData as any).items) (fieldData as any).items = [];
	renderItems((fieldData as any).items);

	addButton.addEventListener("click", () => {
		(fieldData as any).items.push("");
		renderItems((fieldData as any).items);
	});

	container.appendChild(header);
	container.appendChild(itemsContainer);
	container.appendChild(addButton);

	return container;
}

/**
 * Renders XML heading field
 */
function renderXmlHeadingField(
	fieldData: any, // Should be XmlHeadingFieldData
	className: string
): HTMLElement {
	const container = createElement({
		tag: "div",
		className: `${className} xml-heading`,
	});

	// Heading label
	const heading = createElement({
		tag: "h4",
		className: "xml-tag-name",
		innerHTML: `&lt;${fieldData.key}&gt;`,
	});
	container.appendChild(heading);

	// Render children recursively
	if (Array.isArray(fieldData.children)) {
		fieldData.children.forEach((child: any) => {
			container.appendChild(renderFormField(child));
		});
	}

	return container;
}

/**
 * Renders XML value field (textarea for XML content)
 */
function renderXmlValueField(
	fieldData: any, // Should be XmlValueFieldData
	className: string
): HTMLElement {
	return createTextarea({
		tag: "textarea",
		className: `${className} xml-value`,
		name: fieldData.path,
		id: fieldData.path,
		textContent: String(fieldData.textValue || ""), // Use textValue, not value
		attributes: { rows: "3" },
		data: { path: fieldData.path, type: "xml-value" },
	});
}

/**
 * Renders XML attributes field (special handling for XML attributes)
 */
function renderXmlAttributesField(
	fieldData: FormFieldData,
	className: string
): HTMLElement {
	const container = createElement({
		tag: "div",
		className: `${className} xml-attributes`,
		data: { path: fieldData.path, type: "xml-attributes" },
	});

	const header = createElement({
		tag: "div",
		className: "xml-attributes-header",
		textContent: "Attributes:",
	});

	const attributesContainer = createElement({
		tag: "div",
		className: "xml-attributes-list",
		data: { path: fieldData.path },
	});

	container.appendChild(header);
	container.appendChild(attributesContainer);

	return container;
}

/**
 * Renders a complete form container
 */
export function renderFormContainer(
	className: string = "config-form"
): HTMLElement {
	return createForm({
		tag: "form",
		className,
		onsubmit: (e) => e.preventDefault(),
	});
}

/**
 * Renders file header section
 */
export function renderFileHeader(
	fileName: string,
	fileType: string,
	filePath?: string,
	hasHandle?: boolean
): HTMLElement {
	const header = createElement({
		tag: "div",
		className: "file-editor-header",
	});

	// Title container
	const titleContainer = createElement({
		tag: "div",
		className: "file-title-container",
	});

	const title = createElement({
		tag: "h3",
		className: "file-title",
		textContent: fileName,
	});

	// Path display
	const pathDisplay = createElement({
		tag: "div",
		className: "file-path",
	});

	if (filePath && filePath !== fileName) {
		pathDisplay.textContent = `📁 ${filePath}`;
	} else if (hasHandle) {
		pathDisplay.textContent = "📁 Loaded from local file system";
	} else {
		const pathText =
			filePath && filePath !== fileName
				? `💾 ${filePath} (from storage)`
				: "💾 Restored from browser storage";
		pathDisplay.textContent = pathText;
	}

	titleContainer.appendChild(title);
	titleContainer.appendChild(pathDisplay);

	// Type tag
	const typeTag = createElement({
		tag: "span",
		className: "file-type",
		textContent: fileType,
	});

	// Action buttons
	const actionButtons = renderFileActionButtons(fileName, hasHandle);

	header.appendChild(titleContainer);
	header.appendChild(typeTag);
	header.appendChild(actionButtons);

	return header;
}

/**
 * Renders file action buttons
 */
function renderFileActionButtons(
	fileName: string,
	hasHandle?: boolean
): HTMLElement {
	const actionButtons = createElement({
		tag: "div",
		className: "file-action-buttons",
	});

	if (hasHandle) {
		const refreshButton = createButton({
			tag: "button",
			className: "btn btn-info btn-small refresh-file-btn",
			type: "button",
			innerHTML: "🔄 Refresh",
			attributes: {
				"data-file": fileName,
				title: `Reload ${fileName} from disk`,
			},
		});
		actionButtons.appendChild(refreshButton);
	} else {
		const reloadButton = createButton({
			tag: "button",
			className: "btn btn-warning btn-small reload-from-disk-btn",
			type: "button",
			innerHTML: "📁 Reload from Disk",
			attributes: {
				"data-file": fileName,
				title: `Select and reload ${fileName} from disk to get latest content`,
			},
		});
		actionButtons.appendChild(reloadButton);
	}

	const removeButton = createButton({
		tag: "button",
		className: "btn btn-danger btn-small remove-file-btn",
		type: "button",
		innerHTML: "🗑️ Remove",
		attributes: {
			"data-file": fileName,
			title: `Remove ${fileName}`,
		},
	});

	actionButtons.appendChild(removeButton);
	return actionButtons;
}

/**
 * Renders save button container
 */
export function renderSaveContainer(fileName: string): HTMLElement {
	const container = createElement({
		tag: "div",
		className: "save-container",
		attributes: { "data-file": fileName },
	});

	const saveButton = createButton({
		tag: "button",
		className: "btn btn-success btn-small",
		type: "button",
		innerHTML: "💾 Save Changes",
		attributes: { "data-file": fileName },
	});

	container.appendChild(saveButton);

	return container;
}

/**
 * Renders error notification
 */
export function renderErrorNotification(
	message: string,
	className: string = "error-notification"
): HTMLElement {
	return createElement({
		tag: "div",
		className,
		innerHTML: `<strong>Error:</strong> ${message}`,
	});
}

/**
 * Renders error message
 */
export function renderErrorMessage(
	message: string,
	className: string = "error-message"
): HTMLElement {
	return createElement({
		tag: "div",
		className,
		textContent: message,
	});
}
