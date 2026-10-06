/**
 * Modern FormRenderer - Refactored to use pure functions and follow single responsibility principle
 * This class orchestrates the UI modules but doesn't handle DOM creation directly
 */

import { IRenderer, FileData } from "../interfaces";
import { generateFormFieldsData, generateParserFields } from "./form-data";
import {
	renderFormField,
	renderFormContainer,
	renderFileHeader,
	renderErrorMessage,
	FormElementRenderOptions,
} from "./dom-renderer";
import {
	setupFileActionEventListeners,
	setupFormEventListeners,
	FormEventHandlers,
} from "./event-handlers";
import { createElement } from "./dom-factory";
import { edit_array, parse_tree } from "../../parser-wasm/pkg/parser_core.js";
import { previewFormEdits } from "./form-edits";
import type { ParseNode } from "../../parser-wasm/pkg/parser_core.js";
import { RawErrorMeta } from "./raw-error-overlay";
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
		setupFileActionEventListeners(
			header,
			fileData.name,
			this.eventHandlers
		);
		container.appendChild(header);

		// Body wrapper to host either form or raw editor
		const body = createElement({
			tag: "div",
			className: "file-editor-body",
		});
		container.appendChild(body);

		// Hook toggle button and initial render
		this.setupHeaderToggle(header, fileData, body);

		const initialMode: ViewMode =
			this.viewModeById.get(fileData.id) || "form";
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
			this.formsById.delete(fileData.id);
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
		const form = renderFormContainer() as HTMLFormElement;
		this.formsById.set(fileData.id, form);
		setupFormEventListeners(form, this.eventHandlers);

		// If content is not a valid object or had a parse error, show error instead of fields
		const tree = fileData.content?.__tree as ParseNode | undefined;
		if (
			!tree &&
			(!fileData.content ||
				typeof fileData.content !== "object" ||
				Array.isArray(fileData.content) ||
				(typeof fileData.content === "object" &&
					"_error" in fileData.content))
		) {
			const message =
				typeof fileData.content === "object" && fileData.content._error
					? String(fileData.content._error)
					: "Failed to parse file: Not a valid configuration object.";
			const errorDiv = renderErrorMessage(message);
			form.appendChild(errorDiv);
		} else {
			try {
				const formFieldsData = tree
					? generateParserFields(tree)
					: generateFormFieldsData(fileData.content);
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

		form.addEventListener("click", (event) => {
			const target = (
				event.target as HTMLElement
			).closest<HTMLButtonElement>(".add-array-item, .remove-array-item");
			if (!target || fileData.type !== "json") return;
			try {
				const content = previewFormEdits(
					"json",
					fileData.originalContent,
					form
				).content;
				const index = target.classList.contains("remove-array-item")
					? Number(target.dataset.index)
					: undefined;
				const updated = edit_array(
					content,
					JSON.parse(target.dataset.path!),
					index,
					undefined
				);
				form.dataset.draftContent = updated;
				form.replaceChildren(
					this.renderFormFields(
						generateParserFields(parse_tree("json", updated))
					)
				);
				this.eventHandlers.onFileFieldChange?.(
					fileData.id,
					target.dataset.path!,
					"",
					"array"
				);
			} catch (error) {
				form.appendChild(renderErrorMessage(String(error)));
			}
		});
		body.appendChild(form);
	}

	/** Allow controller to push validation overlays to active raw editors */
	getForm(fileId: string): HTMLFormElement | null {
		return this.formsById.get(fileId) ?? null;
	}
	getRawContent(fileId: string): string | undefined {
		return this.rawEditorsById.get(fileId)?.getContent();
	}
	private formsById = new Map<string, HTMLFormElement>();

	applyRawValidation(fileId: string, meta?: RawErrorMeta): void {
		this.rawEditorsById.get(fileId)?.applyValidation(meta);
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
