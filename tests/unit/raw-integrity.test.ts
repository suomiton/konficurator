import { RawEditor } from "../../src/ui/raw-editor";
import { ModernFormRenderer } from "../../src/ui/modern-form-renderer";
import { FileEditorController } from "../../src/controllers/file-editor-controller";
import { FilePersistence } from "../../src/persistence";
import { ParserFactory } from "../../src/parsers";
import { SchemaRegistry } from "../../src/validation/schemaRegistry";
import { FileData } from "../../src/interfaces";

describe("Raw editor integrity and schema validation", () => {
	beforeEach(() => {
		jest.useFakeTimers();
		document.body.innerHTML = '<div id="editorContainer"></div>';
	});
	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
		SchemaRegistry.clear();
		document.body.replaceChildren();
	});
	test.each([
		'{\r\n "a":1\r\n}\r\n',
		"K=a\rK2=b\nK3=\u00a0\r\n",
		'\uFEFF{"a":1}\r\n',
		"\n\n",
	])("keeps original bytes with an error overlay", (content) => {
		const editor = new RawEditor({ fileId: "id", initialContent: content });
		document.body.append(editor.mount());
		editor.applyValidation({ valid: false, line: 1, message: "Boom" });
		expect(editor.getContent()).toBe(content);
		expect(
			document.querySelector(".raw-editor .raw-editor-overlay")
		).toBeNull();
	});
	test("reads browser-created text and line breaks without marker text", () => {
		const editor = new RawEditor({
			fileId: "id",
			initialContent: "a\r\nb",
		});
		document.body.append(editor.mount());
		const root = document.querySelector(".raw-editor")!;
		root.innerHTML = "first<div>second<br>third</div><div><br></div>";
		expect(editor.getContent()).toBe("first\r\nsecond\r\nthird\r\n");
	});
	test("blocks invalid raw autosaves and invokes the registered schema API", async () => {
		const source = '{"port":1}';
		const writes: string[] = [];
		const file: FileData = {
			id: "raw",
			name: "config.json",
			group: "g",
			type: "json",
			originalContent: source,
			content: ParserFactory.createParser("json").parse(source),
			handle: {
				createWritable: async () => ({
					write: async (text: string) => {
						writes.push(text);
					},
					close: async () => {},
				}),
				getFile: async () => ({ lastModified: 1 }),
			} as unknown as FileSystemFileHandle,
		};
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
		const raw = document.querySelector(".raw-editor")!;
		SchemaRegistry.register("g:config.json", {
			type: "object",
			properties: { port: { type: "integer" } },
		});
		raw.textContent = '{"port":';
		controller.scheduleRawAutosave(file.id, 0);
		await jest.advanceTimersByTimeAsync(1);
		expect(writes).toEqual([]);
		raw.textContent = '{"port":"two"}';
		controller.scheduleRawAutosave(file.id, 0);
		await jest.advanceTimersByTimeAsync(1);
		expect(writes).toEqual([]);
		expect(
			document.querySelector(".raw-editor-error")?.textContent
		).toMatch(/integer/);
		raw.textContent = '{"port":2}';
		controller.scheduleRawAutosave(file.id, 0);
		await jest.advanceTimersByTimeAsync(1);
		expect(writes).toEqual(['{"port":2}']);
	});
});
