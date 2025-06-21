import { IParser, ParsedData } from "./interfaces.js";
import { determineFileType } from "./utils/fileTypeUtils.js";

/**
 * Abstract base parser implementing common functionality
 * Follows Open/Closed Principle - open for extension, closed for modification
 */
export abstract class BaseParser implements IParser {
	abstract parse(content: string): ParsedData;
	abstract serialize(data: ParsedData): string;
	abstract getFileType(): string;

	/**
	 * Common validation logic that can be shared across parsers
	 */
	protected validateContent(content: string): void {
		if (!content || content.trim().length === 0) {
			throw new Error("Content cannot be empty");
		}
	}
}

/**
 * JSON Parser implementation
 * Follows Single Responsibility Principle
 */
export class JsonParser extends BaseParser {
	parse(content: string): ParsedData {
		this.validateContent(content);

		try {
			return JSON.parse(content);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			throw new Error(`Invalid JSON format: ${message}`);
		}
	}

	serialize(data: ParsedData): string {
		try {
			return JSON.stringify(data, null, 2);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			throw new Error(`Failed to serialize JSON: ${message}`);
		}
	}

	getFileType(): string {
		return "json";
	}
}

/**
 * XML Parser implementation (Lossless, DOM-based)
 * Supports true round-trip editing and mutation
 */
export class XmlParser extends BaseParser {
	parse(content: string): ParsedData {
		this.validateContent(content);
		const parser = new DOMParser();
		const dom = parser.parseFromString(content, "application/xml");
		const parserError = dom.querySelector("parsererror");
		if (parserError) {
			throw new Error("Invalid XML format");
		}
		// Attach DOM and original XML to the parsed object for later use
		const parsed = this.processXmlElement(dom.documentElement);
		Object.defineProperty(parsed, "__dom", { value: dom, enumerable: false });
		Object.defineProperty(parsed, "__originalXml", {
			value: content,
			enumerable: false,
		});
		return parsed;
	}

	serialize(
		data: ParsedData,
		options?: { mutatePath?: string[]; newValue?: string }
	): string {
		// If the parsed object has a DOM and original XML, use them for lossless serialization
		const dom: Document | undefined = (data as any).__dom;
		if (dom) {
			if (
				options?.mutatePath &&
				options.mutatePath.length > 1 &&
				options.newValue !== undefined
			) {
				let node: Element | null = dom.documentElement;
				for (let i = 1; i < options.mutatePath.length; i++) {
					node = node?.querySelector(options.mutatePath[i]) as Element;
					if (!node) break;
				}
				if (node) node.textContent = options.newValue;
			}
			const serializer = new XMLSerializer();
			return serializer.serializeToString(dom);
		}
		// Fallback: structure-based serialization (not lossless)
		return this.fallbackSerialize(data);
	}

	getFileType(): string {
		return "xml";
	}

	protected processXmlElement(element: Element): ParsedData {
		const result: ParsedData = {};
		const rootName = element.tagName;
		const keyValueElements = Array.from(element.children).filter(
			(child) => child.hasAttribute("key") && child.hasAttribute("value")
		);
		if (keyValueElements.length > 0) {
			keyValueElements.forEach((elem) => {
				const key = elem.getAttribute("key");
				const value = elem.getAttribute("value");
				if (key) {
					result[key] = this.parseValue(value || "");
				}
			});
			return result;
		}
		result[rootName] = this.xmlToObject(element);
		return result;
	}

	private xmlToObject(element: Element): ParsedData {
		const result: ParsedData = {};
		const children = Array.from(element.children);
		const hasAttributes = element.attributes.length > 0;
		const hasChildren = children.length > 0;
		const textContent = element.textContent?.trim() || "";
		const hasTextContent = textContent !== "";

		if (hasAttributes) {
			result["@attributes"] = {};
			for (let i = 0; i < element.attributes.length; i++) {
				const attr = element.attributes[i];
				result["@attributes"][attr.name] = this.parseValue(attr.value);
			}
		}

		if (hasChildren) {
			// Only add children, do not set @value for parent nodes
			children.forEach((child) => {
				const childName = child.tagName;
				const childValue = this.xmlToObject(child);
				if (result[childName]) {
					if (!Array.isArray(result[childName])) {
						result[childName] = [result[childName]];
					}
					result[childName].push(childValue);
				} else {
					result[childName] = childValue;
				}
			});
			result["@type"] = "heading";
		} else if (hasTextContent) {
			// Only set @value for leaf nodes
			result["@type"] = "value";
			result["@value"] = this.parseValue(textContent);
		} else if (hasAttributes) {
			result["@type"] = "attributes";
		} else {
			result["@type"] = "value";
			result["@value"] = "";
		}
		return result;
	}

	private fallbackSerialize(data: ParsedData): string {
		const hasInternalFormats = Object.keys(data).some((key) =>
			key.startsWith("@")
		);
		const hasNestedObjects = Object.values(data).some(
			(value) =>
				typeof value === "object" && value !== null && !Array.isArray(value)
		);
		if (!hasInternalFormats && !hasNestedObjects) {
			let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<appSettings>\n`;
			for (const [key, value] of Object.entries(data)) {
				const escapedValue = this.escapeXml(String(value));
				xml += `\t<add key="${key}" value="${escapedValue}" />\n`;
			}
			xml += "</appSettings>";
			return xml;
		}
		const keys = Object.keys(data);
		if (keys.length === 1) {
			const rootName = keys[0];
			const xmlString = this.objectToXml(data[rootName], rootName);
			return `<?xml version="1.0" encoding="UTF-8"?>\n${xmlString}`;
		} else {
			const xmlString = this.objectToXml(data, "root");
			return `<?xml version="1.0" encoding="UTF-8"?>\n${xmlString}`;
		}
	}

	private parseValue(value: string): any {
		if (value === "true") return true;
		if (value === "false") return false;
		if (!isNaN(Number(value)) && value !== "") return Number(value);
		return value;
	}

	private escapeXml(value: string): string {
		return value
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#39;");
	}

	protected objectToXml(obj: any, nodeName: string): string {
		let xml = `<${nodeName}`;
		// Handle attributes
		if (obj && typeof obj === "object" && obj["@attributes"]) {
			for (const [attr, value] of Object.entries(obj["@attributes"])) {
				xml += ` ${attr}="${this.escapeXml(String(value))}"`;
			}
		}
		xml += ">";
		// Handle value
		if (obj && typeof obj === "object" && "@value" in obj) {
			xml += this.escapeXml(String(obj["@value"]));
		}
		// Handle children
		if (obj && typeof obj === "object") {
			for (const [key, value] of Object.entries(obj)) {
				if (key === "@attributes" || key === "@value" || key === "@type")
					continue;
				if (Array.isArray(value)) {
					for (const item of value) {
						xml += this.objectToXml(item, key);
					}
				} else if (typeof value === "object" && value !== null) {
					xml += this.objectToXml(value, key);
				}
			}
		}
		xml += `</${nodeName}>`;
		return xml;
	}
}

/**
 * ENV Parser implementation for environment variables files (.env)
 * Follows Single Responsibility Principle
 */
export class EnvParser extends BaseParser {
	parse(content: string): ParsedData {
		this.validateContent(content);

		try {
			const result: ParsedData = {};

			// Split by lines and process each line
			const lines = content.split("\n");

			for (const line of lines) {
				// Skip empty lines and comments
				const trimmedLine = line.trim();
				if (!trimmedLine || trimmedLine.startsWith("#")) {
					continue;
				}

				// Split by first = character
				const equalPos = trimmedLine.indexOf("=");
				if (equalPos > 0) {
					const key = trimmedLine.substring(0, equalPos).trim();
					let value = trimmedLine.substring(equalPos + 1).trim();

					// Remove quotes if present
					if (
						(value.startsWith('"') && value.endsWith('"')) ||
						(value.startsWith("'") && value.endsWith("'"))
					) {
						value = value.substring(1, value.length - 1);
					}

					// Try to parse boolean and number values
					result[key] = this.parseValue(value);
				}
			}

			return result;
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			throw new Error(`Failed to parse ENV file: ${message}`);
		}
	}

	serialize(data: ParsedData): string {
		try {
			let result = "";

			for (const [key, value] of Object.entries(data)) {
				// Skip nested objects or arrays
				if (typeof value === "object" && value !== null) {
					result += `# Complex object for key "${key}" represented as JSON string\n`;
					result += `${key}="${JSON.stringify(value)}"\n`;
				} else {
					// Determine if quotes are needed
					let serializedValue = String(value);
					if (serializedValue.includes(" ") || serializedValue.includes("#")) {
						serializedValue = `"${serializedValue}"`;
					}

					result += `${key}=${serializedValue}\n`;
				}
			}

			return result;
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			throw new Error(`Failed to serialize ENV file: ${message}`);
		}
	}

	getFileType(): string {
		return "env";
	}

	/**
	 * Attempts to parse string values to appropriate types
	 */
	private parseValue(value: string): any {
		if (value === "true") return true;
		if (value === "false") return false;
		if (!isNaN(Number(value)) && value !== "") return Number(value);
		return value;
	}
}

/**
 * Parser Factory following Factory Pattern
 * Follows Open/Closed Principle - easy to add new parsers
 */
export class ParserFactory {
	private static parsers: Map<string, () => IParser> = new Map([
		["json", () => new JsonParser()],
		["xml", () => new XmlParser()],
		["config", () => new XmlParser()], // Default for config files
		["env", () => new EnvParser()], // Parser for .env files
	]);

	static createParser(fileType: string, content?: string): IParser {
		// For .config files, determine the actual format from content
		let actualFileType = fileType;
		if (fileType.toLowerCase() === "config" && content) {
			actualFileType = determineFileType("dummy.config", content);
		}

		const parserFactory = this.parsers.get(actualFileType.toLowerCase());
		if (!parserFactory) {
			throw new Error(`Unsupported file type: ${fileType}`);
		}
		return parserFactory();
	}

	/**
	 * Register new parser type (follows Open/Closed Principle)
	 */
	static registerParser(fileType: string, parserFactory: () => IParser): void {
		this.parsers.set(fileType.toLowerCase(), parserFactory);
	}
}
