declare module "../parser-wasm/pkg/parser_core.js" {
	export default function init(...args: unknown[]): Promise<void>;
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
}
