import { IParser, ParsedData } from "./interfaces";
import { parse_tree, ParseNode } from "../parser-wasm/pkg/parser_core.js";
import { determineFileType } from "./utils/fileTypeUtils";

/** The TypeScript adapter contains no format grammar or serialization. */
export abstract class BaseParser implements IParser {
	abstract getFileType(): string;
	parse(content: string): ParsedData {
		try {
			const tree = parse_tree(this.getFileType(), content);
			const data = toDisplayValue(tree);
			const result =
				data !== null && typeof data === "object"
					? data
					: { value: data };
			Object.defineProperty(result, "__tree", {
				value: tree,
				enumerable: false,
			});
			return result;
		} catch (error) {
			throw new Error(
				`Invalid ${this.getFileType().toUpperCase()} format: ${String(error)}`
			);
		}
	}
}
export class JsonParser extends BaseParser {
	getFileType(): string {
		return "json";
	}
}
export class XmlParser extends BaseParser {
	getFileType(): string {
		return "xml";
	}
}
export class EnvParser extends BaseParser {
	getFileType(): string {
		return "env";
	}
}

// Compatibility projection for existing consumers; rendering and saving use the
// exact strings, paths and token kinds in __tree, including large JSON numbers.
function toDisplayValue(node: ParseNode): any {
	if (node.kind === "array") return node.children.map(toDisplayValue);
	if (node.value !== null && !node.children.length) {
		if (node.kind === "boolean") return node.value === "true";
		if (node.kind === "number") return Number(node.value);
		if (node.kind === "null") return null;
		return node.value;
	}
	const result = Object.create(null) as ParsedData;
	if (
		node.value !== null &&
		!node.children.some((child) => child.key === "@value")
	)
		result["@value"] = node.value;
	for (const child of node.children) {
		const value = toDisplayValue(child);
		if (Object.hasOwnProperty.call(result, child.key)) {
			if (!Array.isArray(result[child.key]))
				result[child.key] = [result[child.key]];
			result[child.key].push(value);
		} else result[child.key] = value;
	}
	return result;
}
export class ParserFactory {
	static createParser(fileType: string, content?: string): IParser {
		const type =
			fileType.toLowerCase() === "config"
				? determineFileType("file.config", content)
				: fileType.toLowerCase();
		switch (type) {
			case "json":
				return new JsonParser();
			case "xml":
			case "config":
				return new XmlParser();
			case "env":
				return new EnvParser();
			default:
				throw new Error(`Unsupported file type: ${fileType}`);
		}
	}
}
