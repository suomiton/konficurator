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
import { RawEditor } from "./raw-editor";

type ViewMode = "form" | "raw";

export class ModernFormRenderer implements IRenderer {
	private eventHandlers: FormEventHandlers;
	private renderOptions: FormElementRenderOptions;
	private viewModeById: Map<string, ViewMode> = new Map();
	private rawEditorsById: Map<string, RawEditor> = new Map();

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

		if (fileData.groupColor) {
			container.setAttribute("data-accent", fileData.groupColor);
		} else {
			container.removeAttribute("data-accent");
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

		// Body wrapper to host either form or raw editor
		const body = createElement({ tag: "div", className: "file-editor-body" });
		container.appendChild(body);

		// Hook toggle button and initial render
		this.setupHeaderToggle(header, fileData, body);

		const initialMode: ViewMode = this.viewModeById.get(fileData.id) || "form";
		this.renderEditorBody(fileData, body, initialMode);

		return container;
	}

	private setupHeaderToggle(
		header: HTMLElement,
		fileData: FileData,
		body: HTMLElement
	) {
		const btn = header.querySelector(
			".toggle-raw-btn"
		) as HTMLButtonElement | null;
		if (!btn) return;

		const applyLabel = (mode: ViewMode) => {
			if (mode === "raw") {
				btn.textContent = "Edit Values";
				btn.title = "Edit Values";
				btn.setAttribute("aria-label", "Edit Values");
			} else {
				btn.textContent = "Edit Raw";
				btn.title = "Edit Raw";
				btn.setAttribute("aria-label", "Edit Raw");
			}
		};

		const current = this.viewModeById.get(fileData.id) || "form";
		applyLabel(current);

		btn.addEventListener("click", () => {
			const prev = this.viewModeById.get(fileData.id) || "form";
			const next: ViewMode = prev === "form" ? "raw" : "form";
			this.viewModeById.set(fileData.id, next);
			applyLabel(next);
			// clear any existing raw editor instance when leaving raw mode
			if (prev === "raw") {
				this.rawEditorsById.delete(fileData.id);
			}
			// re-render body in new mode
			body.innerHTML = "";
			this.renderEditorBody(fileData, body, next);
			this.eventHandlers.onToggleView?.(fileData.id, next);
		});
	}

	private renderEditorBody(
		fileData: FileData,
		body: HTMLElement,
		mode: ViewMode
	): void {
		if (mode === "raw") {
			const editor = new RawEditor({
				fileId: fileData.id,
				initialContent: String(fileData.originalContent || ""),
				onChange: (txt) =>
					this.eventHandlers.onRawContentChange?.(fileData.id, txt),
			});
			const mount = editor.mount();
			this.rawEditorsById.set(fileData.id, editor);
			body.appendChild(mount);
			// Reapply overlays if last validation meta exists
			if (this.eventHandlers.onToggleView) {
				// Controller performs reapplication separately; we rely on callback
			}
			return;
		}

		// Default: form view
		const form = renderFormContainer();
		setupFormEventListeners(form);

		// If content is not a valid object or had a parse error, show error instead of fields
		if (
			!fileData.content ||
			typeof fileData.content !== "object" ||
			Array.isArray(fileData.content) ||
			(typeof fileData.content === "object" && "_error" in fileData.content)
		) {
			const message =
				typeof fileData.content === "object" && (fileData.content as any)._error
					? String((fileData.content as any)._error)
					: "Failed to parse file: Not a valid configuration object.";
			const errorDiv = renderErrorMessage(message);
			form.appendChild(errorDiv);
		} else {
			try {
				const formFieldsData = generateFormFieldsData(fileData.content);
				const fieldsContainer = this.renderFormFields(formFieldsData);
				form.appendChild(fieldsContainer);
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Unknown error";
				const errorDiv = renderErrorMessage(
					`Failed to parse ${fileData.name}: ${message}`
				);
				form.appendChild(errorDiv);
			}
		}

		body.appendChild(form);
	}

	/** Allow controller to push validation overlays to active raw editors */
	applyRawValidation(
		fileId: string,
		meta?: {
			valid: boolean;
			errors?: Array<{ message?: string; line?: number; column?: number }>;
			message?: string;
			line?: number;
		}
	): void {
		const editor = this.rawEditorsById.get(fileId);
		if (editor) editor.applyValidation(meta as any);
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
