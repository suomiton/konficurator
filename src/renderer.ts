import { IRenderer, FileData, ParsedData, FieldType } from "./interfaces.js";

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
		const container = document.createElement("div");
		container.className = "file-editor fade-in";
		container.setAttribute("data-file", fileData.name);

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

		// Form
		const form = document.createElement("form");
		form.className = "config-form";
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

		// Set up sticky behavior after container is fully built
		// We need to wait for the DOM to be updated, so use a small delay
		setTimeout(() => {
			this.setupStickyBehavior(saveContainer, fileData.name);
		}, 0);

		return container;
	}

	/**
	 * Generates form fields based on data structure
	 */
	generateFormFields(data: ParsedData, path: string): HTMLElement {
		const container = document.createElement("div");
		container.className = "form-fields";

		for (const [key, value] of Object.entries(data)) {
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
		const header = document.createElement("div");
		header.className = "file-editor-header";

		// Create title container to hold both filename and path
		const titleContainer = document.createElement("div");
		titleContainer.className = "file-title-container";

		const title = document.createElement("h3");
		title.className = "file-title";
		title.textContent = fileData.name;

		// Add file path display below the filename
		const pathDisplay = document.createElement("div");
		pathDisplay.className = "file-path";

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

		const typeTag = document.createElement("span");
		typeTag.className = "file-type";
		typeTag.textContent = fileData.type;

		const removeButton = document.createElement("button");
		removeButton.className = "btn btn-danger btn-small remove-file-btn";
		removeButton.type = "button";
		removeButton.innerHTML = "🗑️ Remove";
		removeButton.setAttribute("data-file", fileData.name);
		removeButton.title = `Remove ${fileData.name}`;

		// Add action buttons based on file state
		const actionButtons = document.createElement("div");
		actionButtons.className = "file-action-buttons";

		if (fileData.handle) {
			// File has disk handle - show refresh button
			const refreshButton = document.createElement("button");
			refreshButton.className = "btn btn-info btn-small refresh-file-btn";
			refreshButton.type = "button";
			refreshButton.innerHTML = "🔄 Refresh";
			refreshButton.setAttribute("data-file", fileData.name);
			refreshButton.title = `Reload ${fileData.name} from disk`;
			actionButtons.appendChild(refreshButton);
		} else {
			// File restored from storage - show reload from disk button
			const reloadButton = document.createElement("button");
			reloadButton.className = "btn btn-warning btn-small reload-from-disk-btn";
			reloadButton.type = "button";
			reloadButton.innerHTML = "📁 Reload from Disk";
			reloadButton.setAttribute("data-file", fileData.name);
			reloadButton.title = `Select and reload ${fileData.name} from disk to get latest content`;
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
		const container = document.createElement("div");
		container.className = "save-container";
		container.setAttribute("data-file", fileData.name);

		const saveButton = document.createElement("button");
		saveButton.className = "btn btn-success btn-small";
		saveButton.type = "button";
		saveButton.innerHTML = "💾 Save Changes";
		saveButton.setAttribute("data-file", fileData.name);

		// Add file name indicator for sticky mode (initially hidden)
		const fileIndicator = document.createElement("span");
		fileIndicator.className = "save-file-indicator";
		fileIndicator.textContent = fileData.name;

		container.appendChild(fileIndicator);
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
		const formGroup = document.createElement("div");
		formGroup.className = "form-group";

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
		const formGroup = document.createElement("div");
		formGroup.className = "form-group";

		const label = document.createElement("label");
		label.textContent = this.formatLabel(key);
		label.setAttribute("for", path);

		const input = document.createElement("input");
		input.type = "text";
		input.id = path;
		input.name = path;
		input.value = String(value || "");

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
		const formGroup = document.createElement("div");
		formGroup.className = "form-group";

		const label = document.createElement("label");
		label.textContent = this.formatLabel(key);
		label.setAttribute("for", path);

		const input = document.createElement("input");
		input.type = "number";
		input.id = path;
		input.name = path;
		input.value = String(value || "");
		input.step = "any"; // Allow decimals

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
		const formGroup = document.createElement("div");
		formGroup.className = "form-group";

		const checkboxContainer = document.createElement("div");
		checkboxContainer.className = "checkbox-container";

		const input = document.createElement("input");
		input.type = "checkbox";
		input.id = path;
		input.name = path;
		input.checked = Boolean(value);

		const label = document.createElement("label");
		label.textContent = this.formatLabel(key);
		label.setAttribute("for", path);

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
		const formGroup = document.createElement("div");
		formGroup.className = "form-group";

		const objectLabel = document.createElement("div");
		objectLabel.className = "object-label";
		objectLabel.textContent = this.formatLabel(key);

		const nestedContainer = document.createElement("div");
		nestedContainer.className = "nested-object";

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
		const formGroup = document.createElement("div");
		formGroup.className = "form-group";

		const label = document.createElement("label");
		label.textContent = `${this.formatLabel(key)} (Array)`;
		label.setAttribute("for", path);

		const textarea = document.createElement("textarea");
		textarea.id = path;
		textarea.name = path;
		textarea.value = JSON.stringify(value, null, 2);
		textarea.rows = 4;
		textarea.setAttribute("data-type", "array");

		formGroup.appendChild(label);
		formGroup.appendChild(textarea);

		return formGroup;
	}

	/**
	 * Creates error message element
	 */
	private createErrorMessage(message: string): HTMLElement {
		const errorDiv = document.createElement("div");
		errorDiv.className = "error";
		errorDiv.textContent = message;
		return errorDiv;
	}

	/**
	 * Creates error notification for parse errors (shown instead of form)
	 */
	private createErrorNotification(errorMessage: string): HTMLElement {
		const notification = document.createElement("div");
		notification.className = "error-notification";

		const icon = document.createElement("div");
		icon.className = "error-icon";
		icon.textContent = "⚠️";

		const content = document.createElement("div");
		content.className = "error-content";

		const title = document.createElement("div");
		title.className = "error-title";
		title.textContent = "Unable to Parse File";

		const message = document.createElement("div");
		message.className = "error-message";
		message.textContent = errorMessage;

		const hint = document.createElement("div");
		hint.className = "error-hint";
		hint.textContent =
			"This file format is not supported for editing. Supported formats: JSON, XML";

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
	 * Sets up sticky behavior for save button using Intersection Observer
	 */
	private setupStickyBehavior(container: HTMLElement, fileName: string): void {
		// Find the file editor container
		const fileEditor = container.closest(".file-editor") as HTMLElement;
		if (!fileEditor) {
			console.warn(`Could not find file-editor for ${fileName}`, container);
			return;
		}

		// Check if sentinel already exists for this file
		const existingSentinel = fileEditor.querySelector(
			`.save-sticky-sentinel[data-file="${fileName}"]`
		);
		if (existingSentinel) {
			console.log(`Sentinel already exists for ${fileName}`);
			return;
		}

		const sentinel = document.createElement("div");
		sentinel.className = "save-sticky-sentinel";
		sentinel.setAttribute("data-file", fileName);
		sentinel.style.height = "1px";
		sentinel.style.width = "100%";
		sentinel.style.pointerEvents = "none";
		fileEditor.appendChild(sentinel);

		console.log(`Created sentinel for ${fileName}`, { fileEditor, sentinel });

		// Set up intersection observer
		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					console.log(`Intersection for ${fileName}:`, {
						isIntersecting: entry.isIntersecting,
						ratio: entry.intersectionRatio,
						boundingRect: entry.boundingClientRect,
					});

					if (entry.isIntersecting) {
						// Sentinel is visible, remove sticky behavior
						container.classList.remove("save-sticky");
						this.removeFromStickyCollection(fileName);
					} else {
						// Sentinel is not visible, make save button sticky within its tile
						container.classList.add("save-sticky");
						this.addToStickyCollection(container, fileName);
					}
				});
			},
			{
				threshold: 0,
				rootMargin: "0px 0px -50px 0px", // Trigger when 50px from bottom
			}
		);

		observer.observe(sentinel);

		// Store observer for cleanup
		container.setAttribute("data-observer", "active");
	}

	/**
	 * Makes save button sticky within its own file editor tile
	 */
	private addToStickyCollection(
		container: HTMLElement,
		fileName: string
	): void {
		console.log(`Making save button sticky for: ${fileName}`);

		// Find the file editor container
		const fileEditor = container.closest(".file-editor") as HTMLElement;
		if (!fileEditor) {
			console.warn(`Could not find file-editor for ${fileName}`, container);
			return;
		}

		// Make the save container sticky within its file editor
		container.classList.add("save-container-sticky");

		// Ensure the file editor has relative positioning for sticky positioning to work
		fileEditor.style.position = "relative";

		console.log(`Made save button sticky for ${fileName}`, {
			fileEditor,
			container,
		});
	}

	/**
	 * Removes sticky behavior from save button
	 */
	private removeFromStickyCollection(fileName: string): void {
		console.log(`Removing sticky behavior for: ${fileName}`);

		// Find all save containers for this file and remove sticky class
		const saveContainers = document.querySelectorAll(
			`.save-container[data-file="${fileName}"]`
		);

		saveContainers.forEach((container) => {
			container.classList.remove("save-container-sticky");
		});

		console.log(`Removed sticky behavior for ${fileName}`);
	}

	/**
	 * Creates XML heading field (container with child elements)
	 */
	private createXmlHeadingField(
		key: string,
		value: any,
		path: string
	): HTMLElement {
		const formGroup = document.createElement("div");
		formGroup.className = "form-group xml-heading";

		const headingLabel = document.createElement("div");
		headingLabel.className = "xml-heading-label";
		headingLabel.textContent = this.formatLabel(key);

		const nestedContainer = document.createElement("div");
		nestedContainer.className = "nested-object";

		// Process child elements, excluding @type
		const childData: any = {};
		for (const [childKey, childValue] of Object.entries(value)) {
			if (childKey !== "@type") {
				childData[childKey] = childValue;
			}
		}

		const nestedFields = this.generateFormFields(childData, path);
		nestedContainer.appendChild(nestedFields);

		formGroup.appendChild(headingLabel);
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
		const formGroup = document.createElement("div");
		formGroup.className = "form-group xml-value";

		const label = document.createElement("label");
		label.textContent = this.formatLabel(key);
		label.setAttribute("for", `${path}.@value`);

		const input = document.createElement("input");
		input.type = "text";
		input.id = `${path}.@value`;
		input.name = `${path}.@value`;
		input.value = String(value["@value"] || "");

		formGroup.appendChild(label);
		formGroup.appendChild(input);

		// Add attributes fields if they exist
		if (value["@attributes"]) {
			const attributesContainer = document.createElement("div");
			attributesContainer.className = "xml-attributes-container";

			const attributesLabel = document.createElement("div");
			attributesLabel.className = "xml-attributes-label";
			attributesLabel.textContent = "Attributes:";
			attributesContainer.appendChild(attributesLabel);

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
		const formGroup = document.createElement("div");
		formGroup.className = "form-group xml-attributes";

		const headingLabel = document.createElement("div");
		headingLabel.className = "xml-attributes-heading";
		headingLabel.textContent = `${this.formatLabel(key)} (Attributes Only)`;

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
		const attrGroup = document.createElement("div");
		attrGroup.className = "form-group attribute-field";

		const label = document.createElement("label");
		label.textContent = key;
		label.setAttribute("for", path);

		const input = document.createElement("input");
		input.type = this.determineInputType(value);
		input.id = path;
		input.name = path;

		if (typeof value === "boolean") {
			input.type = "checkbox";
			input.checked = Boolean(value);
		} else {
			input.value = String(value || "");
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
