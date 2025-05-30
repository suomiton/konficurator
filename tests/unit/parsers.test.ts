import { describe, it, expect, beforeEach } from "@jest/globals";
import {
	JsonParser,
	XmlParser,
	EnvParser,
	ParserFactory,
} from "../../src/parsers";

// Mock DOMParser for testing XML parsing
global.DOMParser = class MockDOMParser {
	parseFromString(content: string, _mimeType: string) {
		// Simulate parser error for invalid XML
		if (
			content.includes("<root><n>test</n>") ||
			content === "invalid-xml-content"
		) {
			return {
				querySelector: (selector: string) => {
					if (selector === "parsererror") {
						return { tagName: "parsererror" };
					}
					return null;
				},
				documentElement: null,
			};
		}

		// For valid XML, return a mock document
		return {
			querySelector: () => null,
			documentElement: {
				tagName: "root",
				attributes: [],
				children: [],
				textContent: "test content",
			},
		};
	}
} as any;

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

	describe("XmlParser", () => {
		let parser: XmlParser;

		beforeEach(() => {
			parser = new XmlParser();
		});

		describe("parse", () => {
			it("should parse simple XML content", () => {
				const xmlContent =
					'<?xml version="1.0"?><config><database><host>localhost</host><port>5432</port></database></config>';

				const result = parser.parse(xmlContent);
				expect(result).toBeDefined();
			});

			it("should parse XML with attributes", () => {
				const xmlContent =
					'<?xml version="1.0"?><config version="1.0" environment="test"><setting name="debug" value="true"/></config>';

				const result = parser.parse(xmlContent);
				expect(result).toBeDefined();
			});

			it("should throw error for invalid XML", () => {
				const invalidXml = "<root><n>test</n>";
				expect(() => parser.parse(invalidXml)).toThrow("Invalid XML format");
			});

			it("should throw error for empty content", () => {
				expect(() => parser.parse("")).toThrow("Content cannot be empty");
				expect(() => parser.parse("   ")).toThrow("Content cannot be empty");
			});
		});

		describe("serialize", () => {
			it("should serialize object to XML format", () => {
				const data = { name: "test", value: 123 };
				const result = parser.serialize(data);

				expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
				expect(result).toContain("<root>");
				expect(result).toContain("</root>");
			});

			it("should handle nested objects in XML serialization", () => {
				const data = {
					config: {
						database: { host: "localhost", port: 5432 },
					},
				};
				const result = parser.serialize(data);

				expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
				expect(result).toContain("<config>");
				expect(result).toContain("</config>");
			});
		});

		describe("getFileType", () => {
			it("should return correct file type", () => {
				expect(parser.getFileType()).toBe("xml");
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

	describe("XmlParser - Element Type Detection", () => {
		let parser: XmlParser;

		beforeEach(() => {
			parser = new XmlParser();

			// Mock a more sophisticated DOMParser for our XML type tests
			global.DOMParser = class MockDOMParser {
				parseFromString(content: string, _mimeType: string) {
					if (content.includes("parsererror-trigger")) {
						return {
							querySelector: (selector: string) =>
								selector === "parsererror" ? { tagName: "parsererror" } : null,
							documentElement: null,
						};
					}

					// Parse simple XML structures for our tests
					if (
						content.includes(
							"<config><server><host>localhost</host><port>8080</port></server></config>"
						)
					) {
						return {
							querySelector: () => null,
							documentElement: {
								tagName: "config",
								attributes: [],
								children: [
									{
										tagName: "server",
										attributes: [],
										children: [
											{
												tagName: "host",
												attributes: [],
												children: [],
												textContent: "localhost",
											},
											{
												tagName: "port",
												attributes: [],
												children: [],
												textContent: "8080",
											},
										],
										textContent: "",
									},
								],
								textContent: "",
							},
						};
					}

					if (
						content.includes('<database connectionString="test" driver="mysql"')
					) {
						return {
							querySelector: () => null,
							documentElement: {
								tagName: "config",
								attributes: [],
								children: [
									{
										tagName: "database",
										attributes: [
											{ name: "connectionString", value: "test" },
											{ name: "driver", value: "mysql" },
										],
										children: [],
										textContent: "",
									},
								],
								textContent: "",
							},
						};
					}

					// Combination: attributes + text content
					if (content.includes('<element attr="a">text</element>')) {
						return {
							querySelector: () => null,
							documentElement: {
								tagName: "element",
								attributes: [{ name: "attr", value: "a" }],
								children: [],
								textContent: "text",
							},
						};
					}

					// Combination: attributes + children
					if (
						content.includes('<element attr="a"><child>c</child></element>')
					) {
						return {
							querySelector: () => null,
							documentElement: {
								tagName: "element",
								attributes: [{ name: "attr", value: "a" }],
								children: [
									{
										tagName: "child",
										attributes: [],
										children: [],
										textContent: "c",
									},
								],
								textContent: "",
							},
						};
					}

					// Combination: attributes + children + text content (mixed)
					if (
						content.includes('<element attr="a">text<child>c</child></element>')
					) {
						return {
							querySelector: () => null,
							documentElement: {
								tagName: "element",
								attributes: [{ name: "attr", value: "a" }],
								children: [
									{
										tagName: "child",
										attributes: [],
										children: [],
										textContent: "c",
									},
								],
								textContent: "text",
							},
						};
					}

					// Empty/self-closing element with attributes
					if (content.includes('<empty attr="a"/>')) {
						return {
							querySelector: () => null,
							documentElement: {
								tagName: "empty",
								attributes: [{ name: "attr", value: "a" }],
								children: [],
								textContent: "",
							},
						};
					}

					// Deeply nested
					if (content.includes("<a><b><c><d>val</d></c></b></a>")) {
						return {
							querySelector: () => null,
							documentElement: {
								tagName: "a",
								attributes: [],
								children: [
									{
										tagName: "b",
										attributes: [],
										children: [
											{
												tagName: "c",
												attributes: [],
												children: [
													{
														tagName: "d",
														attributes: [],
														children: [],
														textContent: "val",
													},
												],
												textContent: "",
											},
										],
										textContent: "",
									},
								],
								textContent: "",
							},
						};
					}

					// Default mock
					return {
						querySelector: () => null,
						documentElement: {
							tagName: "root",
							attributes: [],
							children: [],
							textContent: "test",
						},
					};
				}
			} as any;
		});

		it("should identify heading elements (elements with children)", () => {
			const xml = `<?xml version="1.0" encoding="UTF-8"?>
<config><server><host>localhost</host><port>8080</port></server></config>`;

			const result = parser.parse(xml);

			expect(result.config["@type"]).toBe("heading");
			expect(result.config.server["@type"]).toBe("heading");
		});

		it("should identify value elements (elements with text content)", () => {
			const xml = `<?xml version="1.0" encoding="UTF-8"?>
<config><server><host>localhost</host><port>8080</port></server></config>`;

			const result = parser.parse(xml);

			expect(result.config.server.host["@type"]).toBe("value");
			expect(result.config.server.host["@value"]).toBe("localhost");
			expect(result.config.server.port["@type"]).toBe("value");
			expect(result.config.server.port["@value"]).toBe(8080);
		});

		it("should identify attribute-only elements", () => {
			const xml = `<?xml version="1.0" encoding="UTF-8"?>
<config><database connectionString="test" driver="mysql" /></config>`;

			const result = parser.parse(xml);

			expect(result.config.database["@type"]).toBe("attributes");
			expect(result.config.database["@attributes"]).toBeDefined();
			expect(result.config.database["@attributes"].connectionString).toBe(
				"test"
			);
			expect(result.config.database["@attributes"].driver).toBe("mysql");
		});

		it("should serialize XML with correct structure types", () => {
			const data = {
				config: {
					"@type": "heading",
					server: {
						"@type": "heading",
						host: {
							"@type": "value",
							"@value": "localhost",
						},
					},
					database: {
						"@type": "attributes",
						"@attributes": {
							connectionString: "test",
						},
					},
				},
			};

			const result = parser.serialize(data);

			expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
			expect(result).toContain("<config>");
			expect(result).toContain("<server>");
			expect(result).toContain("<host>localhost</host>");
			expect(result).toContain("</server>");
			expect(result).toContain("</config>");
			expect(result).toContain('<database connectionString="test"/>');
		});

		it("should handle element with both attributes and text content", () => {
			const xml = '<element attr="a">text</element>';
			const result = parser.parse(xml);
			expect(result.element["@type"]).toBe("attributes+value");
			expect(result.element["@attributes"].attr).toBe("a");
			expect(result.element["@value"]).toBe("text");
		});

		it("should handle element with both attributes and children", () => {
			const xml = '<element attr="a"><child>c</child></element>';
			const result = parser.parse(xml);
			expect(result.element["@type"]).toBe("attributes+heading");
			expect(result.element["@attributes"].attr).toBe("a");
			expect(result.element.child["@type"]).toBe("value");
		});

		it("should handle element with attributes, children, and text content (mixed)", () => {
			const xml = '<element attr="a">text<child>c</child></element>';
			const result = parser.parse(xml);
			expect(result.element["@type"]).toBe("attributes+heading+value");
			expect(result.element["@attributes"].attr).toBe("a");
			expect(result.element.child["@type"]).toBe("value");
			expect(result.element["@value"]).toBe("text");
		});

		it("should handle empty/self-closing element with attributes", () => {
			const xml = '<empty attr="a"/>';
			const result = parser.parse(xml);
			expect(result.empty["@type"]).toBe("attributes");
			expect(result.empty["@attributes"].attr).toBe("a");
		});

		it("should handle deeply nested elements", () => {
			const xml = "<a><b><c><d>val</d></c></b></a>";
			const result = parser.parse(xml);
			expect(result.a["@type"]).toBe("heading");
			expect(result.a.b.c.d["@type"]).toBe("value");
			expect(result.a.b.c.d["@value"]).toBe("val");
		});
	});
});
