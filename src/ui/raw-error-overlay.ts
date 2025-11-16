export type RawErrorEntry = {
	message?: string | undefined;
	line?: number | undefined;
	column?: number | undefined;
	start?: number | undefined;
	end?: number | undefined;
};

export type RawErrorMeta = {
	valid: boolean;
	message?: string | undefined;
	line?: number | undefined;
	column?: number | undefined;
	start?: number | undefined;
	end?: number | undefined;
	errors?: RawErrorEntry[] | undefined;
};

export class RawErrorOverlay {
	private overlay: HTMLDivElement;

	private constructor(private readonly rawEl: HTMLDivElement) {
		// Ensure container exists
		const existing = rawEl.querySelector<HTMLDivElement>(
			":scope > .raw-editor-overlay"
		);
		if (existing) {
			this.overlay = existing;
		} else {
			const el = document.createElement("div");
			el.className = "raw-editor-overlay";
			this.overlay = el;
			rawEl.appendChild(el);
		}
	}

	static mount(rawEl: HTMLDivElement): RawErrorOverlay {
		return new RawErrorOverlay(rawEl);
	}

	clear(): void {
		this.overlay
			.querySelectorAll(":scope > .raw-editor-error")
			.forEach((n) => n.remove());
	}

	render(meta?: RawErrorMeta): void {
		this.clear();
		if (!meta || meta.valid) return;

		const errors =
			meta.errors && meta.errors.length ? meta.errors : meta.line ? [meta] : [];
		if (!errors.length) return;

		const cs = window.getComputedStyle(this.rawEl);
		const lineHeight = parseFloat(cs.lineHeight || "0") || 18;
		const paddingTop = parseFloat(cs.paddingTop || "0") || 8;

		const perLineOffsets = new Map<number, number>();
		for (const err of errors) {
			const ln = err.line ?? meta.line;
			if (ln == null) continue;
			const line = Math.max(1, Math.floor(ln));
			const markerTop = paddingTop + (line - 1) * lineHeight + lineHeight;

			const marker = document.createElement("div");
			marker.className = "raw-editor-error raw-editor-error--below";
			marker.style.top = `${Math.max(0, markerTop)}px`;

			const offsetIndex = perLineOffsets.get(line) ?? 0;
			perLineOffsets.set(line, offsetIndex + 1);
			const verticalOffset = 6 + offsetIndex * 20; // consistent spacing between stacked markers
			marker.style.setProperty(
				"--raw-editor-error-offset",
				`${verticalOffset}px`
			);

			const label = document.createElement("span");
			label.className = "raw-editor-error__label";
			label.textContent = `Line ${line}`;
			marker.appendChild(label);

			const text = document.createElement("span");
			text.className = "raw-editor-error__message";
			text.textContent = err.message || meta.message || "Invalid value";
			marker.appendChild(text);

			this.overlay.appendChild(marker);
		}
	}
}
