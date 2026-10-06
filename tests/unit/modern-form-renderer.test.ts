import { ModernFormRenderer } from "../../src/ui/modern-form-renderer";
import { ParserFactory } from "../../src/parsers";
import { FileData } from "../../src/interfaces";

describe("ModernFormRenderer with real DOM", () => {
	afterEach(() => document.body.replaceChildren());
	function mount(content = '{"a":"value"}') {
		const onFileFieldChange = jest.fn();
		const renderer = new ModernFormRenderer({ onFileFieldChange });
		const file: FileData = {
			id: "render-id",
			group: "default",
			name: "test.json",
			type: "json",
			content: ParserFactory.createParser("json").parse(content),
			originalContent: content,
			handle: null,
		};
		const editor = renderer.renderFileEditor(file);
		document.body.append(editor);
		return { renderer, editor, onFileFieldChange, file };
	}
	test("returns the rendered form directly", () => {
		const { renderer, editor } = mount();
		expect(renderer.getForm("render-id")).toBe(
			editor.querySelector("form")
		);
	});
	test("handles nested and array changes through the form", () => {
		const { editor, onFileFieldChange } = mount('{"a":[{"b":1}]}');
		const input = editor.querySelector("input")!;
		input.value = "2";
		input.dispatchEvent(new Event("input", { bubbles: true }));
		expect(onFileFieldChange).toHaveBeenCalledWith(
			"render-id",
			'["a","0","b"]',
			"2",
			"number"
		);
	});
	test("toggles raw mode and keeps overlays outside editable text", () => {
		const { renderer, editor, file } = mount();
		(editor.querySelector(".toggle-raw-btn") as HTMLButtonElement).click();
		expect(renderer.getRawContent(file.id)).toBe(file.originalContent);
		renderer.applyRawValidation(file.id, {
			valid: false,
			line: 1,
			message: "Boom",
		});
		expect(
			editor.querySelector(".raw-editor .raw-editor-overlay")
		).toBeNull();
		expect(renderer.getRawContent(file.id)).toBe(file.originalContent);
		expect(renderer.getForm(file.id)).toBeNull();
		(editor.querySelector(".toggle-raw-btn") as HTMLButtonElement).click();
		expect(renderer.getForm(file.id)).not.toBeNull();
	});
});
