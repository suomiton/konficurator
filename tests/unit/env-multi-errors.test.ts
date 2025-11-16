import { KonficuratorApp } from "../../src/main";

jest.useFakeTimers();

// Basic integration test for ENV multi-error augmentation

describe("ENV multi-error augmentation", () => {
	let app: any;
	beforeEach(() => {
		document.body.innerHTML = "";
		const fileInfo = document.createElement("div");
		fileInfo.id = "fileInfo";
		document.body.appendChild(fileInfo);
		const editorContainer = document.createElement("div");
		editorContainer.id = "editorContainer";
		document.body.appendChild(editorContainer);

		app = new KonficuratorApp();
		// Invalid ENV content: two lines missing '=' plus valid/comment lines
		const rawEnv = `FOO\nBAR=1\n# comment\nBAZ VALUE\nQUX\n`;
		app.loadedFiles = [
			{
				id: "env-id",
				name: "test.env",
				type: "env",
				group: "default",
				content: rawEnv,
				originalContent: rawEnv,
				isActive: true,
			},
		];
		app.renderFileEditors();
	});

	test("shows multi-errors for missing '=' lines in raw mode", () => {
		app.toggleRawMode("env-id"); // enter raw
		app.editorController.requestValidation("env-id", "raw", 0);
		// Fast-forward microtasks & timers
		jest.runAllTimers();
		// Trigger a second validation to ensure augmentation runs after first WASM pass
		app.editorController.requestValidation("env-id", "raw", 0);
		jest.runAllTimers();
		app.editorController.reapplyLastDecorations("env-id");
		const raw = document.querySelector(
			'div.file-editor[data-id="env-id"] .raw-editor'
		) as HTMLElement | null;
		expect(raw).toBeTruthy();
		// Expect at least two error markers (FOO, BAZ VALUE, QUX) -> 3 lines
		const markers = raw!.querySelectorAll(".raw-editor-error");
		expect(markers.length).toBeGreaterThanOrEqual(3);
		const texts = Array.from(markers).map((m) => m.textContent || "");
		expect(texts.some((t) => /Missing '='/.test(t))).toBe(true);
	});
});
