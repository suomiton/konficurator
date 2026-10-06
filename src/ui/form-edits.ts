import { update_value } from "../../parser-wasm/pkg/parser_core.js";

export type EditableInput = HTMLInputElement | HTMLTextAreaElement;
export function fieldValue(input: EditableInput): string {
	return input instanceof HTMLInputElement && input.type === "checkbox"
		? String(input.checked)
		: input.value;
}
export function previewFormEdits(
	type: string,
	original: string,
	form: HTMLFormElement
): {
	content: string;
	values: Map<EditableInput, string>;
} {
	let content = form.dataset.draftContent ?? original;
	const values = new Map<EditableInput, string>();
	for (const input of form.querySelectorAll<EditableInput>(
		"input[data-original-value], textarea[data-original-value]"
	)) {
		const value = fieldValue(input);
		values.set(input, value);
		if (value !== input.dataset.originalValue) {
			const path: unknown = JSON.parse(input.dataset.path!);
			if (
				!Array.isArray(path) ||
				!path.every((part) => typeof part === "string")
			)
				throw new Error("Invalid field path");
			content = update_value(type, content, path, value);
		}
	}
	return { content, values };
}
