import { renderFormField } from "../../src/ui/dom-renderer";
import { generateParserFields } from "../../src/ui/form-data";
import { parse_tree } from "../../parser-wasm/pkg/parser_core.js";

describe("Real DOM renderer", () => {
	test("renders exact numeric tokens including zero", () => {
		const fields = generateParserFields(
			parse_tree(
				"json",
				'{"zero":0,"decimal":1.50,"large":9007199254740993}'
			)
		);
		expect(
			fields.map(
				(field) =>
					(
						renderFormField(field).querySelector(
							"input"
						) as HTMLInputElement
					).value
			)
		).toEqual(["0", "1.50", "9007199254740993"]);
	});
	test("renders object arrays as nested editable fields with array paths", () => {
		const [field] = generateParserFields(
			parse_tree(
				"json",
				'{"servers":[{"host":"a","port":1},{"host":"b","port":2}]}'
			)
		);
		const element = renderFormField(field);
		const inputs = Array.from(
			element.querySelectorAll<HTMLInputElement>("input")
		);
		expect(inputs.map((input) => input.value)).toEqual([
			"a",
			"1",
			"b",
			"2",
		]);
		expect(JSON.parse(inputs[3].dataset.path!)).toEqual([
			"servers",
			"1",
			"port",
		]);
	});
	test("treats object and array labels as untrusted text", () => {
		const data =
			'{"<img src=x onerror=alert(1)>":{},"<script>bad</script>":[]}';
		const elements = generateParserFields(parse_tree("json", data)).map(
			(field) => renderFormField(field)
		);
		for (const element of elements)
			expect(element.querySelector("img, script")).toBeNull();
		expect(elements[0].textContent).toContain("<img");
	});
	test("respects label and class options", () => {
		const [field] = generateParserFields(
			parse_tree("json", '{"a":"value"}')
		);
		const element = renderFormField(field, {
			showLabels: false,
			inputClassName: "custom",
		});
		expect(element.querySelector("label")).toBeNull();
		expect(element.querySelector(".custom")).not.toBeNull();
	});
});
