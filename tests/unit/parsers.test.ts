import {
	ParserFactory,
	JsonParser,
	XmlParser,
	EnvParser,
} from "../../src/parsers";
import { parse_tree } from "../../parser-wasm/pkg/parser_core.js";

describe("Rust-backed display parsers", () => {
	test("projects JSON while retaining exact tokens and paths for editing", () => {
		const data = new JsonParser().parse(
			'{"a.b":1.50,"large":9007199254740993,"s":"true"}'
		);
		expect(data["a.b"]).toBe(1.5);
		expect(data.__tree.children[0]).toMatchObject({
			path: ["a.b"],
			value: "1.50",
			kind: "number",
		});
		expect(data.__tree.children[1].value).toBe("9007199254740993");
		expect(Object.keys(data)).not.toContain("__tree");
	});
	test("preserves XML numeric strings and indexes .NET attributes", () => {
		const text =
			'<appSettings><add key="A" value="1.10"/><add key="B" value="02100"/></appSettings>';
		const data = new XmlParser().parse(text);
		expect(data.appSettings.add[1]["@value"]).toBe("02100");
		expect(data.__tree.children[0].children[1].children[1]).toMatchObject({
			path: ["appSettings", "add", "1", "@value"],
			value: "02100",
		});
	});
	test("uses ENV quoting, export and inline-comment rules for display", () => {
		const data = new EnvParser().parse(
			'\uFEFFexport VER="1.10" # comment\r\nURL=http://x/#frag\r\nPHONE=0401234567\r\n'
		);
		expect(data).toEqual({
			VER: "1.10",
			URL: "http://x/#frag",
			PHONE: "0401234567",
		});
	});
	test.each([
		["json", '{"a":1 "b":2}'],
		["xml", "<r><a></b></r>"],
		["env", 'K="unterminated'],
	])("rejects malformed %s", (type, content) => {
		expect(() => ParserFactory.createParser(type).parse(content)).toThrow();
	});
	test.each([
		['{"a":1}', JsonParser],
		["<r/>", XmlParser],
		["export K=v", EnvParser],
	])("detects config contents %s", (content, parser) => {
		expect(ParserFactory.createParser("config", content)).toBeInstanceOf(
			parser
		);
	});
	test("exposes a root array and root primitive", () => {
		expect(new JsonParser().parse('[1, {"a":2}]').__tree.kind).toBe(
			"array"
		);
		expect(new JsonParser().parse("0").__tree.value).toBe("0");
	});
	test("rejects non-string path segments in the generated WASM API", () => {
		const core = require("../wasm.cjs");
		expect(() => core.update_value("json", '{"a":1}', [1], "2")).toThrow(
			/string/
		);
		expect(parse_tree("json", '\uFEFF{"a":1}').children[0].span.start).toBe(
			8
		);
	});
});
