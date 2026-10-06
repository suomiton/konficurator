import { validate, parse_tree } from "../../parser-wasm/pkg/parser_core.js";

describe("Real WASM ENV positions", () => {
	test("missing equals points to the offending line", () => {
		const result = validate("env", "A=1\r\nFOO 123\r\n");
		expect(result).toMatchObject({
			valid: false,
			line: 2,
			column: 1,
			start: 5,
		});
		expect(result.message).toMatch(/missing '='/);
	});
	test("unterminated multiline quote reports its opening line", () => {
		expect(validate("env", 'FOO="abc\nBAR=ok\n')).toMatchObject({
			valid: false,
			line: 1,
		});
	});
	test("duplicate keys remain separately editable", () => {
		const tree = parse_tree("env", "FOO=1\nBAR=2\nFOO=3\n");
		expect(tree.children[0].path).toEqual(["FOO", "0"]);
		expect(tree.children[2].path).toEqual(["FOO", "1"]);
		expect(validate("env", "FOO=1\nFOO=2\n").valid).toBe(true);
	});
});
