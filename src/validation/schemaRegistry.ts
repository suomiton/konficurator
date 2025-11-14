import { FileData } from "../interfaces";

export type SchemaKey = string;

export interface SchemaMatch {
	key: SchemaKey;
	schema: object;
}

// Simple in-memory registry; users can register schemas at runtime or we can import statics here
const registry = new Map<SchemaKey, object>();

export function registerSchema(key: SchemaKey, schema: object): void {
	registry.set(key, schema);
}

export function clearSchemas(): void {
	registry.clear();
}

// Compute lookup keys from file metadata. Priority order: group+name, group+type, any+name, any+type
function computeKeys(file: FileData): string[] {
	return [
		`${file.group}:${file.name}`,
		`${file.group}:${file.type}`,
		`*:${file.name}`,
		`*:${file.type}`,
	];
}

export function getSchemaForFile(file: FileData): SchemaMatch | null {
	for (const key of computeKeys(file)) {
		const schema = registry.get(key);
		if (schema) {
			return { key, schema };
		}
	}
	return null;
}

// Example: users can import and call registerSchema("payments:app-config.json", schemaObject)
export const SchemaRegistry = {
	register: registerSchema,
	clear: clearSchemas,
	getForFile: getSchemaForFile,
};
