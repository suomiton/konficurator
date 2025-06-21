import { describe, it, expect, beforeEach } from "@jest/globals";
import {
	JsonParser,
	XmlParser,
	EnvParser,
	ParserFactory,
} from "../../src/parsers";

function domEqual(xmlA: string, xmlB: string): boolean {
	const parser = new window.DOMParser();
	const domA = parser.parseFromString(xmlA, "application/xml");
	const domB = parser.parseFromString(xmlB, "application/xml");
	// Remove insignificant whitespace nodes for comparison
	function clean(node: Node) {
		for (let i = node.childNodes.length - 1; i >= 0; i--) {
			const child = node.childNodes[i];
			if (child.nodeType === 3 && !/\S/.test(child.nodeValue || "")) {
				node.removeChild(child);
			} else {
				clean(child);
			}
		}
	}
	clean(domA);
	clean(domB);
	return domA.isEqualNode(domB);
}

describe("Parser Implementations - Real Tests", () => {
	describe("JsonParser", () => {
		let parser: JsonParser;

		beforeEach(() => {
			parser = new JsonParser();
		});

		describe("parse", () => {
			it("should parse valid JSON content", () => {
				const jsonContent = '{"name": "test", "value": 123, "enabled": true}';
				const result = parser.parse(jsonContent);

				expect(result).toEqual({
					name: "test",
					value: 123,
					enabled: true,
				});
			});

			it("should parse nested JSON objects", () => {
				const jsonContent =
					'{"config": {"database": {"host": "localhost", "port": 5432}}}';
				const result = parser.parse(jsonContent);

				expect(result).toEqual({
					config: {
						database: {
							host: "localhost",
							port: 5432,
						},
					},
				});
			});

			it("should parse JSON arrays", () => {
				const jsonContent = '{"items": ["item1", "item2", "item3"]}';
				const result = parser.parse(jsonContent);

				expect(result).toEqual({
					items: ["item1", "item2", "item3"],
				});
			});

			it("should throw error for invalid JSON", () => {
				const invalidJson = '{"name": "test", "value":}';
				expect(() => parser.parse(invalidJson)).toThrow("Invalid JSON format");
			});

			it("should throw error for empty content", () => {
				expect(() => parser.parse("")).toThrow("Content cannot be empty");
				expect(() => parser.parse("   ")).toThrow("Content cannot be empty");
			});
		});

		describe("serialize", () => {
			it("should serialize object to formatted JSON", () => {
				const data = { name: "test", value: 123 };
				const result = parser.serialize(data);

				expect(result).toBe('{\n  "name": "test",\n  "value": 123\n}');
			});

			it("should serialize complex nested objects", () => {
				const data = {
					config: {
						database: { host: "localhost", port: 5432 },
						features: ["auth", "logging"],
					},
				};
				const result = parser.serialize(data);

				const parsed = JSON.parse(result);
				expect(parsed).toEqual(data);
			});

			it("should handle circular reference errors", () => {
				const circular: any = { name: "test" };
				circular.self = circular;

				expect(() => parser.serialize(circular)).toThrow(
					"Failed to serialize JSON"
				);
			});
		});

		describe("getFileType", () => {
			it("should return correct file type", () => {
				expect(parser.getFileType()).toBe("json");
			});
		});
	});

	describe("XmlParser (DOM-based, lossless)", () => {
		let parser: XmlParser;
		beforeEach(() => {
			parser = new XmlParser();
		});

		describe("lossless round-trip", () => {
			it("should preserve XML structure after parse and serialize (simple)", () => {
				const xml = `<?xml version=\"1.0\" encoding=\"UTF-8\"?><root><a>1</a><b>2</b></root>`;
				const parsed = parser.parse(xml);
				const serialized = parser.serialize(parsed);
				expect(domEqual(serialized, xml)).toBe(true);
			});

			it("should preserve whitespace and indentation structurally", () => {
				const xml = `<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<root>\n  <a>1</a>\n  <b>2</b>\n</root>`;
				const parsed = parser.parse(xml);
				const serialized = parser.serialize(parsed);
				expect(domEqual(serialized, xml)).toBe(true);
			});

			it("should preserve comments and their positions structurally", () => {
				const xml = `<?xml version=\"1.0\" encoding=\"UTF-8\"?><root><!--inside--><a>1</a><!--after--></root>`;
				const parsed = parser.parse(xml);
				const serialized = parser.serialize(parsed);
				expect(domEqual(serialized, xml)).toBe(true);
			});

			it("should preserve attribute order and quoting structurally", () => {
				const xml = `<?xml version=\"1.0\"?><root a='1' b=\"2\" c='3'></root>`;
				const parsed = parser.parse(xml);
				const serialized = parser.serialize(parsed);
				expect(domEqual(serialized, xml)).toBe(true);
			});

			it("should preserve self-closing tags vs. explicit open/close structurally", () => {
				const xml = `<root><empty/><notempty></notempty></root>`;
				const parsed = parser.parse(xml);
				const serialized = parser.serialize(parsed);
				expect(domEqual(serialized, xml)).toBe(true);
			});

			it("should preserve mixed content (text + elements)", () => {
				const xml = `<root>text<a>1</a>more</root>`;
				const parsed = parser.parse(xml);
				const serialized = parser.serialize(parsed);
				expect(domEqual(serialized, xml)).toBe(true);
			});

			it("should preserve CDATA sections structurally", () => {
				const xml = `<root><![CDATA[<not>xml</not>]]></root>`;
				const parsed = parser.parse(xml);
				const serialized = parser.serialize(parsed);
				expect(domEqual(serialized, xml)).toBe(true);
			});

			it("should preserve processing instructions structurally", () => {
				const xml = `<?xml version='1.0'?><root><?pi test?></root>`;
				const parsed = parser.parse(xml);
				const serialized = parser.serialize(parsed);
				expect(domEqual(serialized, xml)).toBe(true);
			});

			it("should preserve empty elements structurally", () => {
				const xml = `<root><empty></empty><selfclose/></root>`;
				const parsed = parser.parse(xml);
				const serialized = parser.serialize(parsed);
				expect(domEqual(serialized, xml)).toBe(true);
			});

			it("should preserve unicode and special characters", () => {
				const xml = `<root>Ω≈ç√∫˜µ≤≥÷</root>`;
				const parsed = parser.parse(xml);
				const serialized = parser.serialize(parsed);
				expect(domEqual(serialized, xml)).toBe(true);
			});

			it("should preserve deeply nested structures", () => {
				const xml = `<a><b><c><d>val</d></c></b></a>`;
				const parsed = parser.parse(xml);
				const serialized = parser.serialize(parsed);
				expect(domEqual(serialized, xml)).toBe(true);
			});
		});

		describe("invalid XML handling", () => {
			it("should throw error for invalid XML", () => {
				const invalid = `<root><a></root>`;
				expect(() => parser.parse(invalid)).toThrow(/Invalid XML/);
			});
			it("should throw error for empty content", () => {
				expect(() => parser.parse("")).toThrow(/empty/);
			});
		});

		describe("fallback serialization", () => {
			it("should serialize object to XML if DOM/original XML is missing", () => {
				// Simulate a plain object (no DOM, no __xml)
				const obj = { foo: "bar", baz: 42 };
				const xml = parser.serialize(obj);
				expect(xml).toContain("<appSettings>");
				expect(xml).toContain('<add key="foo" value="bar"');
				expect(xml).toContain('<add key="baz" value="42"');
			});
		});
	});

	describe("EnvParser", () => {
		let parser: EnvParser;

		beforeEach(() => {
			parser = new EnvParser();
		});

		describe("parse", () => {
			it("should parse simple ENV content", () => {
				const envContent = `
					# This is a comment
					KEY1=value1
					KEY2=true
					KEY3=123
					KEY4="value with spaces"
					KEY5='single quotes'
				`;

				const result = parser.parse(envContent);
				expect(result).toEqual({
					KEY1: "value1",
					KEY2: true,
					KEY3: 123,
					KEY4: "value with spaces",
					KEY5: "single quotes",
				});
			});

			it("should handle empty lines and comments", () => {
				const envContent = `
					# This is a comment
					
					KEY1=value1
					# Another comment
					KEY2=value2
				`;

				const result = parser.parse(envContent);
				expect(result).toEqual({
					KEY1: "value1",
					KEY2: "value2",
				});
			});

			it("should throw error for empty content", () => {
				expect(() => parser.parse("")).toThrow("Content cannot be empty");
				expect(() => parser.parse("   ")).toThrow("Content cannot be empty");
			});
		});

		describe("serialize", () => {
			it("should serialize object to ENV format", () => {
				const data = {
					KEY1: "value1",
					KEY2: true,
					KEY3: 123,
					KEY4: "value with spaces",
				};
				const result = parser.serialize(data);

				expect(result).toContain("KEY1=value1");
				expect(result).toContain("KEY2=true");
				expect(result).toContain("KEY3=123");
				expect(result).toContain('KEY4="value with spaces"');
			});

			it("should handle complex objects in ENV serialization", () => {
				const data = {
					KEY1: "value1",
					COMPLEX: {
						nested: "value",
						number: 42,
					},
				};
				const result = parser.serialize(data);

				expect(result).toContain("KEY1=value1");
				expect(result).toContain('# Complex object for key "COMPLEX"');
				expect(result).toContain('COMPLEX="{');
			});
		});

		describe("getFileType", () => {
			it("should return correct file type", () => {
				expect(parser.getFileType()).toBe("env");
			});
		});
	});

	describe("ParserFactory", () => {
		describe("createParser", () => {
			it("should create JsonParser for json file type", () => {
				const parser = ParserFactory.createParser("json");
				expect(parser).toBeInstanceOf(JsonParser);
				expect(parser.getFileType()).toBe("json");
			});

			it("should create XmlParser for xml file type", () => {
				const parser = ParserFactory.createParser("xml");
				expect(parser).toBeInstanceOf(XmlParser);
				expect(parser.getFileType()).toBe("xml");
			});

			it("should create XmlParser for config file type", () => {
				const parser = ParserFactory.createParser("config");
				expect(parser).toBeInstanceOf(XmlParser);
				expect(parser.getFileType()).toBe("xml");
			});

			it("should auto-detect JSON for config files with JSON content", () => {
				const jsonContent = '{"key": "value"}';
				const parser = ParserFactory.createParser("config", jsonContent);
				expect(parser).toBeInstanceOf(JsonParser);
				expect(parser.getFileType()).toBe("json");
			});

			it("should auto-detect XML for config files with XML content", () => {
				const xmlContent = '<?xml version="1.0"?><root><key>value</key></root>';
				const parser = ParserFactory.createParser("config", xmlContent);
				expect(parser).toBeInstanceOf(XmlParser);
				expect(parser.getFileType()).toBe("xml");
			});

			it("should auto-detect ENV for config files with ENV content", () => {
				const envContent = "KEY1=value1\nKEY2=value2\nKEY3=value3";
				const parser = ParserFactory.createParser("config", envContent);
				expect(parser).toBeInstanceOf(EnvParser);
				expect(parser.getFileType()).toBe("env");
			});

			it("should fallback to XML parser for config files with unrecognized content", () => {
				const unknownContent =
					"some random content that is not JSON, XML, or ENV";
				const parser = ParserFactory.createParser("config", unknownContent);
				expect(parser).toBeInstanceOf(XmlParser);
				expect(parser.getFileType()).toBe("xml");
			});

			it("should create EnvParser for env file type", () => {
				const parser = ParserFactory.createParser("env");
				expect(parser).toBeInstanceOf(EnvParser);
				expect(parser.getFileType()).toBe("env");
			});

			it("should throw error for unsupported file type", () => {
				expect(() => ParserFactory.createParser("yaml")).toThrow(
					"Unsupported file type: yaml"
				);
			});

			it("should handle case insensitive file types", () => {
				const jsonParser = ParserFactory.createParser("JSON");
				const xmlParser = ParserFactory.createParser("XML");
				const configParser = ParserFactory.createParser("CONFIG");
				const envParser = ParserFactory.createParser("ENV");

				expect(jsonParser).toBeInstanceOf(JsonParser);
				expect(xmlParser).toBeInstanceOf(XmlParser);
				expect(configParser).toBeInstanceOf(XmlParser);
				expect(envParser).toBeInstanceOf(EnvParser);
			});
		});

		describe("registerParser", () => {
			it("should allow registration of new parser types", () => {
				// Test that we can register a new parser
				const mockParser = {
					parse: () => ({ test: "data" }),
					serialize: () => "serialized",
					getFileType: () => "test",
				};

				ParserFactory.registerParser("test", () => mockParser);
				const parser = ParserFactory.createParser("test");

				expect(parser).toBe(mockParser);
			});
		});
	});
});
