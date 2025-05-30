import { describe, it, expect, beforeEach } from "@jest/globals";
import { JsonParser, XmlParser, ParserFactory } from "../../src/parsers";

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

			it("should throw error for unsupported file type", () => {
				expect(() => ParserFactory.createParser("yaml")).toThrow(
					"Unsupported file type: yaml"
				);
			});

			it("should handle case insensitive file types", () => {
				const jsonParser = ParserFactory.createParser("JSON");
				const xmlParser = ParserFactory.createParser("XML");
				const configParser = ParserFactory.createParser("CONFIG");

				expect(jsonParser).toBeInstanceOf(JsonParser);
				expect(xmlParser).toBeInstanceOf(XmlParser);
				expect(configParser).toBeInstanceOf(XmlParser);
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
