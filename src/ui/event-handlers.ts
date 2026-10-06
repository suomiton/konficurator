import { fieldValue } from "./form-edits";

export interface FormEventHandlers {
	onFileFieldChange?: (
		fileId: string,
		path: string,
		value: string | boolean,
		fieldType: string
	) => void;
	onRawContentChange?: (fileId: string, raw: string) => void;
	onToggleView?: (fileId: string, mode: "form" | "raw") => void;
	onFileRemove?: (fileId: string) => void;
	onFileMinimize?: (fileId: string) => void;
	onFileReload?: (fileId: string) => void;
}

// Form-level delegation covers nested objects, array items and XML attributes.
export function setupFormEventListeners(
	form: HTMLElement,
	handlers: FormEventHandlers = {}
): void {
	form.addEventListener("submit", (event) => event.preventDefault());
	const changed = (event: Event) => {
		const input = event.target;
		if (!(
			input instanceof HTMLInputElement ||
			input instanceof HTMLTextAreaElement
		))
			return;
		const fileId = form.closest<HTMLElement>(".file-editor")?.dataset.id;
		if (fileId)
			handlers.onFileFieldChange?.(
				fileId,
				input.dataset.path || input.name,
				fieldValue(input),
				input.dataset.kind || input.type
			);
	};
	form.addEventListener("input", changed);
	form.addEventListener("change", changed);
}

export function setupFileActionEventListeners(
	header: HTMLElement,
	_fileName: string,
	handlers: FormEventHandlers
): void {
	for (const [selector, callback] of [
		[".remove-file-btn", handlers.onFileRemove],
		[".minimize-file-btn", handlers.onFileMinimize],
		[".reload-from-disk-btn", handlers.onFileReload],
	] as const) {
		const button = header.querySelector<HTMLElement>(selector);
		if (button && callback)
			button.addEventListener("click", () =>
				callback(button.dataset.id!)
			);
	}
}
