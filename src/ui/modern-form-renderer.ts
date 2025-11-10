/**
 * Modern FormRenderer - Refactored to use pure functions and follow single responsibility principle
 * This class orchestrates the UI modules but doesn't handle DOM creation directly
 */

import { IRenderer, FileData } from "../interfaces";
import { generateFormFieldsData } from "./form-data";
import {
	renderFormField,
	renderFormContainer,
	renderFileHeader,
	renderErrorNotification,
	renderErrorMessage,
	FormElementRenderOptions,
} from "./dom-renderer";
import {
	setupFieldEventListeners,
	setupFileActionEventListeners,
	setupFormEventListeners,
	FormEventHandlers,
} from "./event-handlers";
import { createElement } from "./dom-factory";

export class ModernFormRenderer implements IRenderer {
	private eventHandlers: FormEventHandlers;
	private renderOptions: FormElementRenderOptions;

	constructor(
		eventHandlers: FormEventHandlers = {},
		renderOptions: FormElementRenderOptions = {}
	) {
		this.eventHandlers = eventHandlers;
		this.renderOptions = renderOptions;
	}

	/**
	 * Renders a complete file editor component
	 */
	renderFileEditor(fileData: FileData): HTMLElement {
		const container = createElement({
			tag: "div",
			className: "file-editor fade-in",
			attributes: { "data-id": fileData.id },
		});

		// Apply group color to the editor container border if available
		if (fileData.groupColor) {
			(
				container as HTMLElement
			).style.border = `2px solid ${fileData.groupColor}`;
			(container as HTMLElement).style.borderRadius = "8px";
		}

		// Render header
		const header = renderFileHeader(
			fileData.id,
			fileData.name,
			fileData.type,
			!!fileData.handle
		);

		// Setup header event listeners
		setupFileActionEventListeners(header, fileData.name, this.eventHandlers);
		container.appendChild(header);

		// Handle parse errors
		if (
			fileData.content &&
			typeof fileData.content === "object" &&
			"_error" in fileData.content
		) {
			const errorNotification = renderErrorNotification(
				fileData.content._error as string
			);
			container.appendChild(errorNotification);
			return container;
		}

		// Handle invalid content
		if (
			!fileData.content ||
			typeof fileData.content !== "object" ||
			Array.isArray(fileData.content)
		) {
			const errorNotification = renderErrorNotification(
				"Failed to parse file: Not a valid configuration object."
			);
			container.appendChild(errorNotification);
			return container;
		}

		// Render form
		const form = renderFormContainer();
		setupFormEventListeners(form);

		try {
			const formFieldsData = generateFormFieldsData(fileData.content);
			const fieldsContainer = this.renderFormFields(formFieldsData);
			form.appendChild(fieldsContainer);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			const errorDiv = renderErrorMessage(
				`Failed to parse ${fileData.name}: ${message}`
			);
			form.appendChild(errorDiv);
		}

		container.appendChild(form);

		// Save button removed: instant persistence handled via onFieldChange externally

		return container;
	}

	/**
	 * Generates form fields based on data structure (required by IRenderer interface)
	 * This method maintains compatibility with the existing interface
	 */
	generateFormFields(data: any, path: string): HTMLElement {
		const formFieldsData = generateFormFieldsData(data, path);
		return this.renderFormFields(formFieldsData);
	}

	/**
	 * Renders form fields from form field data
	 */
	private renderFormFields(formFieldsData: any[]): HTMLElement {
		const container = createElement({
			tag: "div",
			className: "form-fields",
		});

		for (const fieldData of formFieldsData) {
			const fieldElement = renderFormField(fieldData, this.renderOptions);

			// Setup event listeners for this field
			setupFieldEventListeners(fieldElement, fieldData, this.eventHandlers);

			// Handle nested objects and arrays
			if (
				fieldData.type === "object" &&
				"children" in fieldData &&
				fieldData.children
			) {
				const nestedFields = this.renderFormFields(fieldData.children);
				const fieldsContainer = fieldElement.querySelector(".object-fields");
				if (fieldsContainer) {
					fieldsContainer.appendChild(nestedFields);
				}
			} else if (
				fieldData.type === "array" &&
				"items" in fieldData &&
				fieldData.items
			) {
				// Array items are now handled internally by renderArrayField
				// No need to append additional items here
			}

			container.appendChild(fieldElement);
		}

		return container;
	}

	/**
	 * Updates event handlers
	 */
	setEventHandlers(handlers: FormEventHandlers): void {
		this.eventHandlers = { ...this.eventHandlers, ...handlers };
	}

	/**
	 * Updates render options
	 */
	setRenderOptions(options: FormElementRenderOptions): void {
		this.renderOptions = { ...this.renderOptions, ...options };
	}

	/**
	 * Gets current event handlers (useful for testing)
	 */
	getEventHandlers(): FormEventHandlers {
		return { ...this.eventHandlers };
	}

	/**
	 * Gets current render options (useful for testing)
	 */
	getRenderOptions(): FormElementRenderOptions {
		return { ...this.renderOptions };
	}
}
