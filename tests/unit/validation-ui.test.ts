import { KonficuratorApp } from "../../src/main";

describe("Validation UI decorations", () => {
	let app: any;

	// jsdom doesn't implement Element.scrollTo; stub it for tests
	beforeAll(() => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(HTMLElement as any).prototype.scrollTo = jest.fn();
	});

	beforeEach(() => {
		document.body.innerHTML = "";
		const fileInfo = document.createElement("div");
		fileInfo.id = "fileInfo";
		document.body.appendChild(fileInfo);
		const editorContainer = document.createElement("div");
		editorContainer.id = "editorContainer";
		document.body.appendChild(editorContainer);

		app = new KonficuratorApp();
		// Seed with one file
		app.loadedFiles = [
			{
				id: "v-id",
				name: "v.env",
				type: "env",
				group: "default",
				content: "FOO=1\nBAR=2\n",
				originalContent: "FOO=1\nBAR=2\n",
				isActive: true,
			},
		];
		// Render editors
		app.renderFileEditors();
	});

	afterEach(() => {
		document.body.innerHTML = "";
	});

	test("badge and raw editor classes toggle on setValidationState", () => {
		// Initial editor
		let editor = document.querySelector(
			'div.file-editor[data-id="v-id"]'
		) as HTMLElement | null;
		expect(editor).toBeTruthy();
		// Enable raw mode (mount raw editor, triggers re-render)
		app.toggleRawMode("v-id");
		editor = document.querySelector(
			'div.file-editor[data-id="v-id"]'
		) as HTMLElement | null;
		expect(editor).toBeTruthy();
		let raw = document.querySelector(
			'div.file-editor[data-id="v-id"] .raw-editor'
		) as HTMLElement | null;
		expect(raw).toBeTruthy();

		// Set invalid state with position meta
		app["setValidationState"]("v-id", false, "missing '='", undefined, {
			line: 1,
			column: 5,
			start: 0,
			end: 0,
		});
		let badge = editor!.querySelector(
			".validation-badge"
		) as HTMLDivElement | null;
		// If badge attached to a fresh editor ref, re-query
		if (!badge) {
			editor = document.querySelector(
				'div.file-editor[data-id="v-id"]'
			) as HTMLElement | null;
			badge = editor!.querySelector(
				".validation-badge"
			) as HTMLDivElement | null;
		}
		expect(badge).toBeTruthy();
		expect(badge!.classList.contains("is-invalid")).toBe(true);
		expect(badge!.textContent || "").toMatch(/Invalid/);
		raw = document.querySelector(
			'div.file-editor[data-id="v-id"] .raw-editor'
		) as HTMLElement | null;
		expect(raw!.classList.contains("has-error")).toBe(true);
		expect(raw!.classList.contains("is-valid")).toBe(false);

		// Now set valid state and check classes flip
		app["setValidationState"]("v-id", true);
		badge = document.querySelector(
			'div.file-editor[data-id="v-id"] .validation-badge'
		) as HTMLDivElement | null;
		expect(badge!.classList.contains("is-valid")).toBe(true);
		expect(badge!.classList.contains("is-invalid")).toBe(false);
		raw = document.querySelector(
			'div.file-editor[data-id="v-id"] .raw-editor'
		) as HTMLElement | null;
		expect(raw!.classList.contains("is-valid")).toBe(true);
		expect(raw!.classList.contains("has-error")).toBe(false);
	});

	test("lastValidationMeta reapplies on re-render in raw mode", () => {
		// Set invalid meta and toggle raw mode off/on, ensure decoration reapplies
		app["setValidationState"]("v-id", false, "duplicate key 'FOO'", undefined, {
			line: 1,
			column: 1,
			start: 0,
			end: 0,
		});
		app.toggleRawMode("v-id"); // enter raw
		let raw = document.querySelector(
			'div.file-editor[data-id="v-id"] .raw-editor'
		) as HTMLElement | null;
		expect(raw).toBeTruthy();
		expect(raw!.classList.contains("has-error")).toBe(true);
		// Exit and re-enter raw mode
		app.toggleRawMode("v-id"); // exit raw
		app.toggleRawMode("v-id"); // re-enter raw
		raw = document.querySelector(
			'div.file-editor[data-id="v-id"] .raw-editor'
		) as HTMLElement | null;
		expect(raw).toBeTruthy();
		// Decoration should be applied from lastValidationMeta
		expect(raw!.classList.contains("has-error")).toBe(true);
	});
});
