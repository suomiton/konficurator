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

        test("raw editor classes toggle and inline errors are rendered", () => {
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
                raw = document.querySelector(
                        'div.file-editor[data-id="v-id"] .raw-editor'
                ) as HTMLElement | null;
                expect(raw!.classList.contains("has-error")).toBe(true);
                expect(raw!.classList.contains("is-valid")).toBe(false);
                const inlineErrors = raw!.querySelectorAll(".raw-editor-error");
                expect(inlineErrors.length).toBe(1);
                expect(inlineErrors[0].textContent || "").toContain("missing '='");

                // Now set valid state and check classes flip
                app["setValidationState"]("v-id", true);
                raw = document.querySelector(
                        'div.file-editor[data-id="v-id"] .raw-editor'
                ) as HTMLElement | null;
                expect(raw!.classList.contains("is-valid")).toBe(true);
                expect(raw!.classList.contains("has-error")).toBe(false);
                expect(raw!.querySelectorAll(".raw-editor-error").length).toBe(0);
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
                expect(raw!.querySelectorAll(".raw-editor-error").length).toBe(1);
                // Exit and re-enter raw mode
                app.toggleRawMode("v-id"); // exit raw
                app.toggleRawMode("v-id"); // re-enter raw
                raw = document.querySelector(
                        'div.file-editor[data-id="v-id"] .raw-editor'
                ) as HTMLElement | null;
                expect(raw).toBeTruthy();
                // Decoration should be applied from lastValidationMeta
                expect(raw!.classList.contains("has-error")).toBe(true);
                expect(raw!.querySelectorAll(".raw-editor-error").length).toBe(1);
        });
});
