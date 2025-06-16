import { IRenderer, FileData, ParsedData, FieldType } from "./interfaces.js";
import { createElement, createButton } from "./ui/dom-factory.js";

/**
 * Rendering Module
 * Dynamically generates HTML forms based on parsed data
 * Follows Single Responsibility Principle
 */
export class FormRenderer implements IRenderer {
	/**
	 * Renders a complete file editor component
	 */
	renderFileEditor(fileData: FileData): HTMLElement {
		const container = createElement({
			tag: "div",
			className: "file-editor fade-in",
			attributes: { "data-file": fileData.name },
		});

		// Header
		const header = this.createFileHeader(fileData);
		container.appendChild(header);

		// Check if content has parse error
		if (
			fileData.content &&
			typeof fileData.content === "object" &&
			"_error" in fileData.content
		) {
			// Show error notification instead of form
			const errorNotification = this.createErrorNotification(
				fileData.content._error as string
			);
			container.appendChild(errorNotification);
			return container; // Don't add form or save button for error case
		}

		// NEW: If content is not a plain object, show error
		if (
			!fileData.content ||
			typeof fileData.content !== "object" ||
			Array.isArray(fileData.content)
		) {
			const errorNotification = this.createErrorNotification(
				"Failed to parse file: Not a valid configuration object."
			);
			container.appendChild(errorNotification);
			return container;
		}

		// Form
		const form = createElement({
			tag: "form",
			className: "config-form",
		});
		form.addEventListener("submit", (e) => e.preventDefault());

		try {
			const formFields = this.generateFormFields(fileData.content, "");
			form.appendChild(formFields);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			const errorDiv = this.createErrorMessage(
				`Failed to parse ${fileData.name}: ${message}`
			);
			form.appendChild(errorDiv);
		}

		container.appendChild(form);

		// Save button
		const saveContainer = this.createSaveContainer(fileData);
		container.appendChild(saveContainer);

		return container;
	}

	/**
	 * Generates form fields based on data structure
	 */
	generateFormFields(data: ParsedData, path: string): HTMLElement {
		const container = createElement({
			tag: "div",
			className: "form-fields",
		});

		for (const [key, value] of Object.entries(data)) {
			// Hide @type, @value, and @attributes fields for XML - these are handled by XML-specific field types
			if (key === "@type" || key === "@value" || key === "@attributes")
				continue;
			const fieldPath = path ? `${path}.${key}` : key;
			const fieldType = this.determineFieldType(value);
			const fieldElement = this.createFormField(
				key,
				value,
				fieldPath,
				fieldType
			);
			container.appendChild(fieldElement);
		}

		return container;
	}

	/**
	 * Creates file editor header
	 */
	private createFileHeader(fileData: FileData): HTMLElement {
		const header = createElement({
			tag: "div",
			className: "file-editor-header",
		});

		// Create title container to hold both filename and path
		const titleContainer = createElement({
			tag: "div",
			className: "file-title-container",
		});

		const title = createElement({
			tag: "h3",
			className: "file-title",
			textContent: fileData.name,
		});

		// Add file path display below the filename
		const pathDisplay = createElement({
			tag: "div",
			className: "file-path",
		});

		// Determine path text based on available information
		if (fileData.path && fileData.path !== fileData.name) {
			// Show actual file path if available and different from name
			pathDisplay.textContent = `📁 ${fileData.path}`;
		} else if (fileData.handle) {
			// File was loaded from file system but no specific path available
			pathDisplay.textContent = "📁 Loaded from local file system";
		} else {
			// File was restored from browser storage
			const pathText =
				fileData.path && fileData.path !== fileData.name
					? `💾 ${fileData.path} (from storage)`
					: "💾 Restored from browser storage";
			pathDisplay.textContent = pathText;
		}

		titleContainer.appendChild(title);
		titleContainer.appendChild(pathDisplay);

		const typeTag = createElement({
			tag: "span",
			className: "file-type",
			textContent: fileData.type,
		});

		const removeButton = createButton({
			tag: "button",
			className: "btn btn-danger btn-small remove-file-btn",
			type: "button",
			innerHTML: "🗑️ Remove",
			attributes: {
				"data-file": fileData.name,
				title: `Remove ${fileData.name}`,
			},
		});

		// Add action buttons based on file state
		const actionButtons = createElement({
			tag: "div",
			className: "file-action-buttons",
		});

		if (fileData.handle) {
			// File has disk handle - show refresh button
			const refreshButton = createButton({
				tag: "button",
				className: "btn btn-info btn-small refresh-file-btn",
				type: "button",
				innerHTML: "🔄 Refresh",
				attributes: {
					"data-file": fileData.name,
					title: `Reload ${fileData.name} from disk`,
				},
			});
			actionButtons.appendChild(refreshButton);
		} else {
			// File restored from storage - show reload from disk button
			const reloadButton = createButton({
				tag: "button",
				className: "btn btn-warning btn-small reload-from-disk-btn",
				type: "button",
				innerHTML: "📁 Reload from Disk",
				attributes: {
					"data-file": fileData.name,
					title: `Select and reload ${fileData.name} from disk to get latest content`,
				},
			});
			actionButtons.appendChild(reloadButton);
		}

		actionButtons.appendChild(removeButton);

		header.appendChild(titleContainer);
		header.appendChild(typeTag);
		header.appendChild(actionButtons);

		return header;
	}

	/**
	 * Creates save button container
	 */
	private createSaveContainer(fileData: FileData): HTMLElement {
		const container = createElement({
			tag: "div",
			className: "save-container",
			attributes: { "data-file": fileData.name },
		});

		const saveButton = createButton({
			tag: "button",
			className: "btn btn-success btn-small",
			type: "button",
			innerHTML: "💾 Save Changes",
			attributes: { "data-file": fileData.name },
		});

		container.appendChild(saveButton);

		return container;
	}

	/**
	 * Creates individual form field based on type
	 */
	private createFormField(
		key: string,
		value: any,
		path: string,
		type: FieldType
	): HTMLElement {
		switch (type) {
			case "xml-heading":
				return this.createXmlHeadingField(key, value, path);
			case "xml-value":
				return this.createXmlValueField(key, value, path);
			case "xml-attributes":
				return this.createXmlAttributesField(key, value, path);
			case "object":
				return this.createObjectField(key, value, path);
			case "array":
				return this.createArrayField(key, value, path);
			case "boolean":
				return this.createBooleanField(key, value, path);
			case "number":
				return this.createNumberField(key, value, path);
			default:
				return this.createTextField(key, value, path);
		}
	}

	/**
	 * Creates text input field
	 */
	private createTextField(key: string, value: any, path: string): HTMLElement {
		const formGroup = createElement({
			tag: "div",
			className: "form-group",
		});

		const label = createElement({
			tag: "label",
			textContent: this.formatLabel(key),
			attributes: { for: path },
		});

		const input = createElement({
			tag: "input",
			attributes: {
				type: "text",
				id: path,
				name: path,
				value: String(value || ""),
			},
		});

		formGroup.appendChild(label);
		formGroup.appendChild(input);

		return formGroup;
	}

	/**
	 * Creates number input field
	 */
	private createNumberField(
		key: string,
		value: any,
		path: string
	): HTMLElement {
		const formGroup = createElement({
			tag: "div",
			className: "form-group",
		});

		const label = createElement({
			tag: "label",
			textContent: this.formatLabel(key),
			attributes: { for: path },
		});

		const input = createElement({
			tag: "input",
			attributes: {
				type: "number",
				id: path,
				name: path,
				value: String(value || ""),
				step: "any", // Allow decimals
			},
		});

		formGroup.appendChild(label);
		formGroup.appendChild(input);

		return formGroup;
	}

	/**
	 * Creates boolean checkbox field
	 */
	private createBooleanField(
		key: string,
		value: any,
		path: string
	): HTMLElement {
		const formGroup = createElement({
			tag: "div",
			className: "form-group",
		});

		const checkboxContainer = createElement({
			tag: "div",
			className: "checkbox-container",
		});

		const input = createElement({
			tag: "input",
			attributes: {
				type: "checkbox",
				id: path,
				name: path,
			},
		});
		(input as HTMLInputElement).checked = Boolean(value);

		const label = createElement({
			tag: "label",
			textContent: this.formatLabel(key),
			attributes: { for: path },
		});

		checkboxContainer.appendChild(input);
		checkboxContainer.appendChild(label);
		formGroup.appendChild(checkboxContainer);

		return formGroup;
	}

	/**
	 * Creates nested object field
	 */
	private createObjectField(
		key: string,
		value: any,
		path: string
	): HTMLElement {
		const formGroup = createElement({
			tag: "div",
			className: "form-group",
		});

		const objectLabel = createElement({
			tag: "div",
			className: "object-label",
			textContent: this.formatLabel(key),
		});

		const nestedContainer = createElement({
			tag: "div",
			className: "nested-object",
		});

		const nestedFields = this.generateFormFields(value, path);
		nestedContainer.appendChild(nestedFields);

		formGroup.appendChild(objectLabel);
		formGroup.appendChild(nestedContainer);

		return formGroup;
	}

	/**
	 * Creates array field (simplified - treating as JSON string for now)
	 */
	private createArrayField(key: string, value: any, path: string): HTMLElement {
		const formGroup = createElement({
			tag: "div",
			className: "form-group",
		});

		const label = createElement({
			tag: "label",
			textContent: `${this.formatLabel(key)} (Array)`,
			attributes: { for: path },
		});

		const textarea = createElement({
			tag: "textarea",
			attributes: {
				id: path,
				name: path,
				rows: "4",
				"data-type": "array",
			},
		});
		(textarea as HTMLTextAreaElement).value = JSON.stringify(value, null, 2);

		formGroup.appendChild(label);
		formGroup.appendChild(textarea);

		return formGroup;
	}

	/**
	 * Creates error message element
	 */
	private createErrorMessage(message: string): HTMLElement {
		const errorDiv = createElement({
			tag: "div",
			className: "error",
			textContent: message,
		});
		return errorDiv;
	}

	/**
	 * Creates error notification for parse errors (shown instead of form)
	 */
	private createErrorNotification(errorMessage: string): HTMLElement {
		const notification = createElement({
			tag: "div",
			className: "error-notification",
		});

		const icon = createElement({
			tag: "div",
			className: "error-icon",
			textContent: "⚠️",
		});

		const content = createElement({
			tag: "div",
			className: "error-content",
		});

		const title = createElement({
			tag: "div",
			className: "error-title",
			textContent: "Unable to Parse File",
		});

		const message = createElement({
			tag: "div",
			className: "error-message",
			textContent: errorMessage,
		});

		const hint = createElement({
			tag: "div",
			className: "error-hint",
			textContent:
				"This file format is not supported for editing. Supported formats: JSON, XML",
		});

		content.appendChild(title);
		content.appendChild(message);
		content.appendChild(hint);

		notification.appendChild(icon);
		notification.appendChild(content);

		return notification;
	}

	/**
	 * Determines field type based on value
	 */
	private determineFieldType(value: any): FieldType {
		if (value === null || value === undefined) {
			return "text";
		}

		// Handle XML-specific types
		if (typeof value === "object" && value["@type"]) {
			switch (value["@type"]) {
				case "heading":
					return "xml-heading";
				case "value":
					return "xml-value";
				case "attributes":
					return "xml-attributes";
			}
		}

		if (Array.isArray(value)) {
			return "array";
		}

		switch (typeof value) {
			case "boolean":
				return "boolean";
			case "number":
				return "number";
			case "object":
				return "object";
			default:
				return "text";
		}
	}

	/**
	 * Formats field labels for better readability
	 */
	private formatLabel(key: string): string {
		return key
			.replace(/([A-Z])/g, " $1") // Add space before capital letters
			.replace(/^./, (str) => str.toUpperCase()) // Capitalize first letter
			.replace(/_/g, " ") // Replace underscores with spaces
			.trim();
	}

	/**
	 * Creates XML heading field (container with child elements)
	 */
	private createXmlHeadingField(
		key: string,
		value: any,
		path: string
	): HTMLElement {
		const formGroup = createElement({
			tag: "div",
			className: "form-group xml-heading",
		});

		const headingLabel = createElement({
			tag: "div",
			className: "xml-heading-label",
			textContent: this.formatLabel(key),
		});

		// Render attributes block at the top if present
		if (value["@attributes"]) {
			const attributesBlock = createElement({
				tag: "div",
				className: "xml-attributes-block",
			});

			const badge = createElement({
				tag: "span",
				className: "xml-attributes-badge",
			});
			// Remove text content - visual distinction maintained through CSS styling
			attributesBlock.appendChild(badge);

			for (const [attrKey, attrValue] of Object.entries(value["@attributes"])) {
				const attrField = this.createAttributeField(
					attrKey,
					attrValue,
					`${path}.@attributes.${attrKey}`
				);
				attributesBlock.appendChild(attrField);
			}

			formGroup.appendChild(attributesBlock);
		}

		formGroup.appendChild(headingLabel);

		const nestedContainer = createElement({
			tag: "div",
			className: "nested-object",
		});

		// Process child elements, excluding @type, @value, and @attributes
		const childData: any = {};
		for (const [childKey, childValue] of Object.entries(value)) {
			if (
				childKey !== "@type" &&
				childKey !== "@value" &&
				childKey !== "@attributes"
			) {
				childData[childKey] = childValue;
			}
		}

		const nestedFields = this.generateFormFields(childData, path);
		nestedContainer.appendChild(nestedFields);

		formGroup.appendChild(nestedContainer);

		return formGroup;
	}

	/**
	 * Creates XML value field (editable input for text content)
	 */
	private createXmlValueField(
		key: string,
		value: any,
		path: string
	): HTMLElement {
		const formGroup = createElement({
			tag: "div",
			className: "form-group xml-value",
		});

		const label = createElement({
			tag: "label",
			textContent: this.formatLabel(key),
			attributes: { for: `${path}.@value` },
		});

		const input = createElement({
			tag: "input",
			attributes: {
				type: "text",
				id: `${path}.@value`,
				name: `${path}.@value`,
				value: String(value["@value"] || ""),
			},
		});

		formGroup.appendChild(label);
		formGroup.appendChild(input);

		// Add attributes fields if they exist
		if (value["@attributes"]) {
			const attributesContainer = createElement({
				tag: "div",
				className: "xml-attributes-container",
			});

			// Remove the attributesLabel block entirely
			// for (const [attrKey, attrValue] of Object.entries(value["@attributes"])) {
			for (const [attrKey, attrValue] of Object.entries(value["@attributes"])) {
				const attrField = this.createAttributeField(
					attrKey,
					attrValue,
					`${path}.@attributes.${attrKey}`
				);
				attributesContainer.appendChild(attrField);
			}

			formGroup.appendChild(attributesContainer);
		}

		return formGroup;
	}

	/**
	 * Creates XML attributes field (multiple attribute inputs)
	 */
	private createXmlAttributesField(
		key: string,
		value: any,
		path: string
	): HTMLElement {
		const formGroup = createElement({
			tag: "div",
			className: "form-group xml-attributes",
		});

		const headingLabel = createElement({
			tag: "div",
			className: "xml-attributes-heading",
			textContent: this.formatLabel(key),
		});

		formGroup.appendChild(headingLabel);

		// Create input fields for each attribute
		if (value["@attributes"]) {
			for (const [attrKey, attrValue] of Object.entries(value["@attributes"])) {
				const attrField = this.createAttributeField(
					attrKey,
					attrValue,
					`${path}.@attributes.${attrKey}`
				);
				formGroup.appendChild(attrField);
			}
		}

		return formGroup;
	}

	/**
	 * Creates individual attribute field
	 */
	private createAttributeField(
		key: string,
		value: any,
		path: string
	): HTMLElement {
		const attrGroup = createElement({
			tag: "div",
			className: "form-group attribute-field",
		});

		const label = createElement({
			tag: "label",
			textContent: key,
		});
		// Do NOT set label.setAttribute("for", path) to avoid making it editable

		const input = createElement({
			tag: "input",
			attributes: {
				type: this.determineInputType(value),
				id: path,
				name: path,
			},
		});

		if (typeof value === "boolean") {
			(input as HTMLInputElement).checked = Boolean(value);
		} else {
			(input as HTMLInputElement).value = String(value || "");
		}

		attrGroup.appendChild(label);
		attrGroup.appendChild(input);

		return attrGroup;
	}

	/**
	 * Determines HTML input type for attribute values
	 */
	private determineInputType(value: any): string {
		if (typeof value === "boolean") {
			return "checkbox";
		}
		if (typeof value === "number") {
			return "number";
		}
		return "text";
	}
}
