declare module "../parser-wasm/pkg/parser_core.js" {
	export default function init(...args: unknown[]): Promise<void>;
	export type SchemaValidationError = {
		message: string;
		keyword?: string;
		instancePath: string;
		schemaPath?: string;
		line?: number;
		column?: number;
		start?: number;
		end?: number;
	};
	export function update_value(
		fileType: string,
		originalContent: string,
		path: string[],
		newValue: string
	): string;
	export function validate(
		fileType: string,
		content: string
	): {
		valid: boolean;
		message?: string;
		line?: number;
		column?: number;
		start?: number;
		end?: number;
	};
	export function validate_multi(
		fileType: string,
		content: string,
		maxErrors?: number
	): {
		valid: boolean;
		errors: Array<{
			message: string;
			code?: string;
			line: number;
			column: number;
			start: number;
			end: number;
		}>;
		summary?: {
			message: string;
			line: number;
			column: number;
			start: number;
			end: number;
		};
	};
	export function validate_schema(
		content: string,
		schema: string,
		options?: {
			maxErrors?: number;
			collectPositions?: boolean;
			draft?: string;
		}
	): {
		valid: boolean;
		errors?: SchemaValidationError[];
	};
	export function validate_schema_with_id(
		content: string,
		schemaId: string,
		options?: {
			maxErrors?: number;
			collectPositions?: boolean;
			draft?: string;
		}
	): {
		valid: boolean;
		errors?: SchemaValidationError[];
	};
	export function register_schema(schemaId: string, schema: string): void;
}
