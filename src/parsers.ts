import { IParser, ParsedData } from "./interfaces.js";

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
 * XML Parser implementation
 * Follows Single Responsibility Principle
 */
export class XmlParser extends BaseParser {
	parse(content: string): ParsedData {
		this.validateContent(content);

		try {
			const parser = new DOMParser();
			const xmlDoc = parser.parseFromString(content, "text/xml");

			// Check for parsing errors
			const parserError = xmlDoc.querySelector("parsererror");
			if (parserError) {
				throw new Error("Invalid XML format");
			}

			return this.xmlToObject(xmlDoc.documentElement);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			throw new Error(`Failed to parse XML: ${message}`);
		}
	}

	serialize(data: ParsedData): string {
		try {
			const xmlString = this.objectToXml(data, "root");
			return `<?xml version="1.0" encoding="UTF-8"?>\n${xmlString}`;
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			throw new Error(`Failed to serialize XML: ${message}`);
		}
	}

	getFileType(): string {
		return "xml";
	}

	/**
	 * Converts XML element to JavaScript object
	 */
	private xmlToObject(element: Element): ParsedData {
		const result: ParsedData = {};

		// Handle attributes
		if (element.attributes.length > 0) {
			result["@attributes"] = {};
			for (let i = 0; i < element.attributes.length; i++) {
				const attr = element.attributes[i];
				result["@attributes"][attr.name] = attr.value;
			}
		}

		// Handle child elements
		const children = Array.from(element.children);
		if (children.length === 0) {
			// Leaf node - return text content
			const textContent = element.textContent?.trim() || "";
			return this.parseValue(textContent);
		}

		children.forEach((child) => {
			const childName = child.tagName;
			const childValue = this.xmlToObject(child);

			if (result[childName]) {
				// Convert to array if multiple elements with same name
				if (!Array.isArray(result[childName])) {
					result[childName] = [result[childName]];
				}
				result[childName].push(childValue);
			} else {
				result[childName] = childValue;
			}
		});

		return result;
	}

	/**
	 * Converts JavaScript object to XML string
	 */
	private objectToXml(obj: any, rootName: string): string {
		if (typeof obj !== "object" || obj === null) {
			return `<${rootName}>${this.escapeXml(String(obj))}</${rootName}>`;
		}

		let xml = `<${rootName}`;
		let content = "";

		// Handle attributes
		if (obj["@attributes"]) {
			for (const [key, value] of Object.entries(obj["@attributes"])) {
				xml += ` ${key}="${this.escapeXml(String(value))}"`;
			}
		}

		// Handle other properties
		for (const [key, value] of Object.entries(obj)) {
			if (key === "@attributes") continue;

			if (Array.isArray(value)) {
				value.forEach((item) => {
					content += this.objectToXml(item, key);
				});
			} else {
				content += this.objectToXml(value, key);
			}
		}

		if (content) {
			xml += `>${content}</${rootName}>`;
		} else {
			xml += "/>";
		}

		return xml;
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

	/**
	 * Escapes XML special characters
	 */
	private escapeXml(value: string): string {
		return value
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#39;");
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
		["config", () => new JsonParser()], // Treat config files as JSON
	]);

	static createParser(fileType: string): IParser {
		const parserFactory = this.parsers.get(fileType.toLowerCase());
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
