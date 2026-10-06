import { RawErrorOverlay, RawErrorMeta } from "./raw-error-overlay";

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
	private lineEndings: string[] = [];
	private defaultLineEnding = "\n";
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
		const read = (node: Node): string => {
			if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
			if (node instanceof HTMLBRElement) return "\n";
			const children = Array.from(node.childNodes);
			if (children.length === 1 && children[0] instanceof HTMLBRElement)
				return "";
			let text = "";
			children.forEach((child, index) => {
				if (
					index > 0 &&
					child instanceof HTMLElement &&
					["DIV", "P"].includes(child.tagName)
				)
					text += "\n";
				text += read(child);
			});
			return text;
		};
		const text = read(this.root);
		return text
			.replace(/\r\n?/g, "\n")
			.split("\n")
			.map(
				(line, index, all) =>
					line +
					(index < all.length - 1
						? (this.lineEndings[index] ?? this.defaultLineEnding)
						: "")
			)
			.join("");
	}

	setContent(text: string): void {
		// Split into lines and create separate line divs for easier future enhancements
		this.root.innerHTML = "";
		this.lineEndings = text.match(/\r\n|\r|\n/g) ?? [];
		this.defaultLineEnding = this.lineEndings[0] ?? "\n";
		const lines = text.split(/\r\n|\r|\n/);
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

	applyValidation(meta?: RawErrorMeta): void {
		if (!this.overlay && this.root.parentElement)
			this.overlay = RawErrorOverlay.mount(this.root);
		this.root.classList.toggle("has-error", meta?.valid === false);
		this.root.classList.toggle("is-valid", meta?.valid !== false);
		this.overlay?.render(meta);
	}

	updateGutter(): void {
		const lines = Array.from(this.root.children);
		const count = lines.length || 1;
		const numbers = Array.from(
			{ length: count },
			(_, i) => `${i + 1}`
		).join("\n");
		this.gutter.textContent = numbers;
		this.gutter.dataset.lineCount = String(count);
		this.gutter.scrollTop = this.root.scrollTop;
	}

	private handleInput = () => {
		this.updateGutter();
		this.onChange?.(this.getContent());
	};
}
