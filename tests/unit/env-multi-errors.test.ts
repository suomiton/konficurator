import { validate_multi } from "../../parser-wasm/pkg/parser_core.js";
import { FileEditorController } from "../../src/controllers/file-editor-controller";
import { ModernFormRenderer } from "../../src/ui/modern-form-renderer";
import { FilePersistence } from "../../src/persistence";
import { FileData } from "../../src/interfaces";

describe("ENV diagnostics from the shared scanner", () => {
	beforeEach(() => {
		jest.useFakeTimers();
		document.body.innerHTML = '<div id="editorContainer"></div>';
	});
	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
		document.body.replaceChildren();
	});
	test("reports each bad line once and renders markers outside the raw content", async () => {
		const text = "FOO\nBAR=1\n# comment\nBAZ VALUE\nQUX\n";
		const result = validate_multi("env", text, 50);
		expect(result.errors.map((error) => error.line)).toEqual([1, 4, 5]);
		const file = {
			id: "env",
			group: "default",
			name: "test.env",
			type: "env",
			content: { _error: "invalid" },
			originalContent: text,
			handle: null,
		} as FileData;
		const renderer = new ModernFormRenderer();
		const controller = new FileEditorController({
			renderer,
			persistence: new FilePersistence(),
			getFiles: () => [file],
			saveToStorage: async () => {},
		});
		controller.renderEditors([file]);
		(
			document.querySelector(".toggle-raw-btn") as HTMLButtonElement
		).click();
		controller.requestValidation(file.id, "raw", 0);
		await jest.advanceTimersByTimeAsync(1);
		expect(document.querySelectorAll(".raw-editor-error")).toHaveLength(3);
		expect(
			document.querySelector(".raw-editor .raw-editor-error")
		).toBeNull();
		expect(renderer.getRawContent(file.id)).toBe(text);
	});
});
