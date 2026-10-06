import { FilePersistence } from "../../src/persistence";
import { ParserFactory } from "../../src/parsers";
import { ModernFormRenderer } from "../../src/ui/modern-form-renderer";
import { FileData } from "../../src/interfaces";

function mount(type: FileData["type"], source: string) {
	const writes: string[] = [];
	const writable = {
		write: jest.fn(async (content: string) => {
			writes.push(content);
		}),
		close: jest.fn(async () => {}),
	};
	const file: FileData = {
		id: "id",
		group: "group",
		name: `test.${type}`,
		type,
		content: ParserFactory.createParser(type, source).parse(source),
		originalContent: source,
		handle: {
			name: `test.${type}`,
			createWritable: async () => writable,
		} as unknown as FileSystemFileHandle,
	};
	const renderer = new ModernFormRenderer();
	const editor = renderer.renderFileEditor(file);
	document.body.append(editor);
	const form = renderer.getForm(file.id)!;
	const input = (path: string[]) =>
		Array.from(
			form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
				"input, textarea"
			)
		).find((element) => element.dataset.path === JSON.stringify(path))!;
	return {
		writes,
		writable,
		file,
		renderer,
		form,
		input,
		persistence: new FilePersistence(),
	};
}
describe("Real parse → form → WASM edit → write round trips", () => {
	afterEach(() => {
		document.body.replaceChildren();
		jest.restoreAllMocks();
	});
	test.each([
		[
			"json",
			'{\r\n "Logging": {"Microsoft.AspNetCore":"Warning"}, "a\\\"b": "x"\r\n}\r\n',
			["Logging", "Microsoft.AspNetCore"],
			"Info",
			'{\r\n "Logging": {"Microsoft.AspNetCore":"Info"}, "a\\\"b": "x"\r\n}\r\n',
		],
		[
			"json",
			'{"servers":[{"host":"a","port":1}, {"host":"b","port":2}],"list":[1,2]}',
			["servers", "1", "port"],
			"5",
			'{"servers":[{"host":"a","port":1}, {"host":"b","port":5}],"list":[1,2]}',
		],
		[
			"json",
			'{"list": [\n  1,\n  true,\n  "1.0"\n]}',
			["list", "2"],
			"true",
			'{"list": [\n  1,\n  true,\n  "true"\n]}',
		],
		[
			"json",
			'\uFEFF{"a":9007199254740993,"b":1.50,"c":0}',
			["c"],
			"2",
			'\uFEFF{"a":9007199254740993,"b":1.50,"c":2}',
		],
		[
			"xml",
			'<configuration><appSettings><add key="A" value="1"/><add key="B" value="02100"/></appSettings></configuration>',
			["configuration", "appSettings", "add", "1", "@value"],
			"0401234567",
			'<configuration><appSettings><add key="A" value="1"/><add key="B" value="0401234567"/></appSettings></configuration>',
		],
		[
			"xml",
			'<appSettings><add key="A" value="1"/><add key="B" value="2"/></appSettings>',
			["appSettings", "add", "1", "@value"],
			"3",
			'<appSettings><add key="A" value="1"/><add key="B" value="3"/></appSettings>',
		],
		[
			"xml",
			"<r><empty/><data><![CDATA[a < b]]></data><phone>0401234567</phone></r>",
			["r", "empty"],
			"v",
			"<r><empty>v</empty><data><![CDATA[a < b]]></data><phone>0401234567</phone></r>",
		],
		[
			"env",
			'\uFEFFexport database.host="local"  # comment\r\nURL=http://x/#frag\r\nVER=1.10\r\n',
			["database.host"],
			"remote",
			'\uFEFFexport database.host="remote"  # comment\r\nURL=http://x/#frag\r\nVER=1.10\r\n',
		],
	] as Array<[FileData["type"], string, string[], string, string]>)(
		"changes only one %s value",
		async (type, source, path, value, expected) => {
			const context = mount(type, source);
			await context.persistence.saveFile(context.file, context.form);
			expect(context.writes).toEqual([]);
			expect(context.input(path)).toBeDefined();
			context.input(path).value = value;
			await context.persistence.saveFile(context.file, context.form);
			expect(context.writes).toEqual([expected]);
			await context.persistence.saveFile(context.file, context.form);
			expect(context.writes).toHaveLength(1);
		}
	);
	test("handles consecutive quoted ENV edits", async () => {
		const context = mount("env", "K=v # comment\n");
		context.input(["K"]).value = 'a "q"';
		await context.persistence.saveFile(context.file, context.form);
		context.input(["K"]).value = "z";
		await context.persistence.saveFile(context.file, context.form);
		expect(context.writes).toEqual([
			'K="a \\"q\\"" # comment\n',
			'K="z" # comment\n',
		]);
	});
	test("handles booleans inside arrays and nested XML attributes", async () => {
		const context = mount("json", '{"a":[true,false]}');
		(context.input(["a", "0"]) as HTMLInputElement).checked = false;
		await context.persistence.saveFile(context.file, context.form);
		expect(context.writes).toEqual(['{"a":[false,false]}']);
	});
	test("adds and removes array items without rewriting other tokens", async () => {
		const context = mount("json", '{"a": [\n  1,\n  2\n], "other":1.50}');
		(
			context.form.querySelector(".add-array-item") as HTMLButtonElement
		).click();
		context.input(["a", "2"]).value = "new";
		await context.persistence.saveFile(context.file, context.form);
		expect(context.writes[0]).toBe(
			'{"a": [\n  1,\n  2,\n  "new"\n], "other":1.50}'
		);
		await context.persistence.saveFile(context.file, context.form);
		expect(context.writes).toHaveLength(1);
		(
			context.form.querySelectorAll(
				".remove-array-item"
			)[1] as HTMLButtonElement
		).click();
		await context.persistence.saveFile(context.file, context.form);
		expect(context.writes[1]).toBe(
			'{"a": [\n  1,\n  "new"\n], "other":1.50}'
		);
	});
	test("rejects invalid raw content before opening a writable stream", async () => {
		const context = mount("json", '{"a":1}');
		await expect(
			context.persistence.saveRaw(context.file, '{"a":')
		).rejects.toThrow();
		expect(context.writes).toEqual([]);
		expect(context.file.originalContent).toBe('{"a":1}');
	});
	test("does not advance the baseline when writing fails", async () => {
		const context = mount("json", '{"a":1}');
		context.input(["a"]).value = "2";
		context.writable.write.mockRejectedValueOnce(new Error("disk failed"));
		await expect(
			context.persistence.saveFile(context.file, context.form)
		).rejects.toThrow("disk failed");
		expect(context.file.originalContent).toBe('{"a":1}');
		expect(context.input(["a"]).dataset.originalValue).toBe("1");
	});
});
