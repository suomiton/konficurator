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
		
		// Determine path text based on file source
		if (fileData.handle) {
			// File was loaded from file system
			pathDisplay.textContent = "📁 Loaded from local file system";
		} else {
			// File was restored from browser storage
			pathDisplay.textContent = "💾 Restored from browser storage";
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

		header.appendChild(titleContainer);
		header.appendChild(typeTag);
		header.appendChild(removeButton);

		return header;
	}

	/**
	 * Creates save button container
	 */
	private createSaveContainer(fileData: FileData): HTMLElement {
		const container = document.createElement("div");
		container.className = "save-container";

		const saveButton = document.createElement("button");
		saveButton.className = "btn btn-success btn-small";
		saveButton.type = "button";
		saveButton.innerHTML = "💾 Save Changes";
		saveButton.setAttribute("data-file", fileData.name);

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
	 * Determines field type based on value
	 */
	private determineFieldType(value: any): FieldType {
		if (value === null || value === undefined) {
			return "text";
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
}
