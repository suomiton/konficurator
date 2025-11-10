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
} from "./dom-factory";
import { createIcon } from "./icon";
import {
	FormFieldData,
	TextFieldData,
	NumberFieldData,
	BooleanFieldData,
	XmlHeadingFieldData,
	XmlValueFieldData,
	XmlAttributesFieldData,
	XmlAttributeField,
	formatLabel,
} from "./form-data";

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

	if (input instanceof HTMLInputElement && input.type === "checkbox") {
		formGroup.classList.add("checkbox");
	}

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
			return renderXmlHeadingField(fieldData as XmlHeadingFieldData, className);
		case "xml-value":
			return renderXmlValueField(fieldData as XmlValueFieldData, className);
		case "xml-attributes":
			return renderXmlAttributesField(
				fieldData as XmlAttributesFieldData,
				className
			);
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
		innerHTML: `<h4>${fieldData.label}</h4>`,
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
		attributes: {
			name: fieldData.path,
			"data-original-value": JSON.stringify((fieldData as any).value || []),
		},
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
	fieldData: XmlHeadingFieldData,
	className: string
): HTMLElement {
	const container = createElement({
		tag: "div",
		className: `${className} xml-heading`,
		data: { path: fieldData.path, type: "xml-heading" },
	});

	const heading = createElement({
		tag: "h4",
		className: "xml-tag-name",
		innerHTML: `&lt;${fieldData.key}&gt;`,
	});
	container.appendChild(heading);

	const attributesList = renderXmlAttributeList(fieldData);
	if (attributesList) {
		container.appendChild(attributesList);
	}

	if (Array.isArray(fieldData.children)) {
		fieldData.children.forEach((child) => {
			container.appendChild(renderFormField(child));
		});
	}

	return container;
}

/**
 * Renders XML value field (textarea for XML content)
 */
function renderXmlValueField(
	fieldData: XmlValueFieldData,
	className: string
): HTMLElement {
	const container = createElement({
		tag: "div",
		className: `${className} xml-value-field`,
		data: { path: fieldData.path, type: "xml-value" },
	});

	const textarea = createTextarea({
		tag: "textarea",
		className: `${className} xml-value`,
		name: fieldData.path,
		id: fieldData.path,
		textContent: String(fieldData.textValue || ""),
		attributes: { rows: "3" },
	});

	container.appendChild(textarea);

	const attributesList = renderXmlAttributeList(fieldData);
	if (attributesList) {
		container.appendChild(attributesList);
	}

	return container;
}

/**
 * Renders XML attributes field (special handling for XML attributes)
 */
function renderXmlAttributesField(
	fieldData: XmlAttributesFieldData,
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
		textContent: fieldData.label || "Attributes",
	});
	container.appendChild(header);

	const attributesList = renderXmlAttributeList(fieldData);
	if (attributesList) {
		container.appendChild(attributesList);
	}

	return container;
}

function renderXmlAttributeList(
	fieldData: XmlHeadingFieldData | XmlValueFieldData | XmlAttributesFieldData
): HTMLElement | null {
	const attributeFields = resolveXmlAttributeFields(fieldData);
	if (attributeFields.length === 0) {
		return null;
	}

	const list = createElement({
		tag: "div",
		className: "xml-attributes-list",
		data: { path: fieldData.path },
	});

	attributeFields.forEach((attribute) => {
		list.appendChild(renderSingleXmlAttribute(attribute));
	});

	return list;
}

function resolveXmlAttributeFields(
	fieldData: XmlHeadingFieldData | XmlValueFieldData | XmlAttributesFieldData
): XmlAttributeField[] {
	if (fieldData.attributeFields && fieldData.attributeFields.length > 0) {
		return fieldData.attributeFields;
	}

	if (!fieldData.attributes) {
		return [];
	}

	return Object.entries(fieldData.attributes).map(([key, value]) => ({
		key,
		label: formatLabel(key),
		path: fieldData.path ? `${fieldData.path}.@${key}` : `@${key}`,
		value,
		inputType:
			typeof value === "boolean"
				? "boolean"
				: typeof value === "number"
				? "number"
				: "text",
	}));
}

function renderSingleXmlAttribute(attribute: XmlAttributeField): HTMLElement {
	const container = createElement({
		tag: "div",
		className: "xml-attribute-field",
	});

	const label = createElement({
		tag: "label",
		className: "xml-attribute-label",
		textContent: `@${attribute.key}`,
		attributes: { for: attribute.path },
	});

	let input: HTMLElement;
	switch (attribute.inputType) {
		case "boolean":
			input = createInput({
				tag: "input",
				className: "xml-attribute-input checkbox-input",
				type: "checkbox",
				name: attribute.path,
				id: attribute.path,
				checked: Boolean(attribute.value),
				data: { path: attribute.path },
			});
			break;
		case "number":
			input = createInput({
				tag: "input",
				className: "xml-attribute-input",
				type: "number",
				name: attribute.path,
				id: attribute.path,
				value: String(attribute.value ?? ""),
				data: { path: attribute.path },
			});
			break;
		default:
			input = createInput({
				tag: "input",
				className: "xml-attribute-input",
				type: "text",
				name: attribute.path,
				id: attribute.path,
				value: String(attribute.value ?? ""),
				data: { path: attribute.path },
			});
			break;
	}

	container.appendChild(label);
	container.appendChild(input);

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
	fileId: string,
	fileName: string,
	fileType: string,
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
		tag: "span",
		className: "file-title",
		textContent: fileName,
	});

	// Type tag (moved inside titleContainer before the filename)
	const typeTag = createElement({
		tag: "span",
		className: "file-type",
		textContent: fileType,
	});

	// Inline wrapper for type + title for controlled flex gap
	const titleInlineWrapper = createElement({
		tag: "div",
		className: "file-title-inline",
	});

	titleInlineWrapper.appendChild(typeTag);
	titleInlineWrapper.appendChild(title);
	titleContainer.appendChild(titleInlineWrapper);

	// File path display removed as redundant (filename already shown in title)

	// Action buttons
	const actionButtons = renderFileActionButtons(fileId, hasHandle);

	header.appendChild(titleContainer);
	header.appendChild(actionButtons);

	return header;
}

/**
 * Renders file action buttons
 */
function renderFileActionButtons(
	fileId: string,
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
			attributes: {
				"data-id": fileId,
				title: `Reload from disk`,
				"aria-label": `Reload from disk`,
			},
		});
		refreshButton.appendChild(
			createIcon("refresh-cw", { size: 18, className: "btn-icon" })
		);
		actionButtons.appendChild(refreshButton);
	} else {
		const reloadButton = createButton({
			tag: "button",
			className: "btn btn-warning btn-small reload-from-disk-btn",
			type: "button",
			attributes: {
				"data-id": fileId,
				title: `Select and reload from disk to get latest content`,
				"aria-label": `Select and reload from disk to get latest content`,
			},
		});
		reloadButton.appendChild(
			createIcon("folder", { size: 18, className: "btn-icon" })
		);
		actionButtons.appendChild(reloadButton);
	}

	const removeButton = createButton({
		tag: "button",
		className: "btn btn-danger btn-small remove-file-btn",
		type: "button",
		attributes: {
			"data-id": fileId,
			title: `Remove`,
			"aria-label": `Remove`,
		},
	});
	removeButton.appendChild(
		createIcon("trash", { size: 18, className: "btn-icon" })
	);

	actionButtons.appendChild(removeButton);
	return actionButtons;
}

/**
 * Renders save button container
 */
export function renderSaveContainer(fileId: string): HTMLElement {
	const container = createElement({
		tag: "div",
		className: "save-container",
		attributes: { "data-id": fileId },
	});

	const saveButton = createButton({
		tag: "button",
		className: "btn btn-success btn-small",
		type: "button",
		attributes: { "data-id": fileId },
	});
	saveButton.appendChild(
		createIcon("save", { size: 18, className: "btn-icon" })
	);
	saveButton.appendChild(document.createTextNode(" Save Changes"));

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
	const container = createElement({
		tag: "div",
		className,
	});

	container.appendChild(
		createIcon("alert-triangle", { size: 24, className: "error-icon" })
	);

	const content = createElement({
		tag: "div",
		className: "error-content",
	});

	content.appendChild(
		createElement({
			tag: "strong",
			className: "error-title",
			textContent: "Error:",
		})
	);

	content.appendChild(
		createElement({
			tag: "div",
			className: "error-message",
			textContent: message,
		})
	);

	container.appendChild(content);
	return container;
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
