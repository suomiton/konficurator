import { RawErrorOverlay } from "./raw-error-overlay";

export interface RawEditorOptions {
	fileId: string;
	initialContent: string;
	onChange?: (newContent: string) => void;
}

export class RawEditor {
	private root: HTMLDivElement;
	private gutter: HTMLDivElement;
	private overlay: RawErrorOverlay | null = null;
	private fileId: string;
	private onChange: ((c: string) => void) | undefined;

	constructor(opts: RawEditorOptions) {
		this.fileId = opts.fileId;
		this.onChange = opts.onChange
			? (c: string) => opts.onChange!(c)
			: undefined;
		this.root = document.createElement("div");
		this.root.className = "raw-editor";
		this.root.setAttribute("contenteditable", "true");
		this.root.setAttribute("data-id", this.fileId);
		this.root.addEventListener("input", this.handleInput);
		this.root.addEventListener("blur", this.handleInput);
		this.gutter = document.createElement("div");
		this.gutter.className = "raw-editor-gutter";
		this.setContent(opts.initialContent);
	}

	mount(): HTMLElement {
		const wrapper = document.createElement("div");
		wrapper.className = "raw-editor-wrapper";
		wrapper.setAttribute("data-id", this.fileId);
		wrapper.appendChild(this.gutter);
		wrapper.appendChild(this.root);
		this.overlay = RawErrorOverlay.mount(this.root);
		return wrapper;
	}

	getContent(): string {
		// Build content from raw-line divs explicitly, stripping NBSP
		const lines: string[] = [];
		for (const child of Array.from(this.root.children)) {
			if (!(child instanceof HTMLElement)) continue;
			let txt = child.textContent || "";
			// Replace non-breaking spaces with empty (they were only layout placeholders)
			txt = txt.replace(/\u00A0/g, "");
			lines.push(txt);
		}
		return lines.join("\n");
	}

	setContent(text: string): void {
		// Split into lines and create separate line divs for easier future enhancements
		this.root.innerHTML = "";
		const lines = text.replace(/\r\n/g, "\n").split("\n");
		for (const line of lines) {
			const lineEl = document.createElement("div");
			lineEl.className = "raw-line";
			if (line.length) {
				lineEl.textContent = line;
			} else {
				// Keep truly empty; CSS will ensure visual height
				lineEl.textContent = "";
			}
			this.root.appendChild(lineEl);
		}
		this.updateGutter();
	}

	applyValidation(meta?: {
		valid: boolean;
		errors?: Array<{ message?: string; line?: number; column?: number }>;
		message?: string;
		line?: number;
	}): void {
		if (!this.overlay) this.overlay = RawErrorOverlay.mount(this.root);
		this.root.classList.toggle("has-error", meta?.valid === false);
		this.root.classList.toggle("is-valid", meta?.valid !== false);
		this.overlay.render(meta as any);
	}

	updateGutter(): void {
		const lines = Array.from(this.root.children);
		const count = lines.length || 1;
		const numbers = Array.from({ length: count }, (_, i) => `${i + 1}`).join(
			"\n"
		);
		this.gutter.textContent = numbers;
		this.gutter.dataset.lineCount = String(count);
		this.gutter.scrollTop = this.root.scrollTop;
	}

	private handleInput = () => {
		// Normalize empty divs to retain visual space
		// Remove any accidental NBSP introduced by browser edits
		Array.from(this.root.children).forEach((child) => {
			if (child instanceof HTMLElement) {
				if (child.textContent && /\u00A0/.test(child.textContent)) {
					child.textContent = child.textContent.replace(/\u00A0/g, "");
				}
			}
		});
		this.updateGutter();
		this.onChange?.(this.getContent());
	};
}
