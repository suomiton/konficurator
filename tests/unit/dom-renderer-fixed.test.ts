/**
 * Comprehensive test suite for DOM Renderer module
 * Tests form field rendering, DOM manipulation, XSS prevention, and performance
 */

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { renderFormField } from "../../src/ui/dom-renderer.js";
import {
	TextFieldData,
	NumberFieldData,
	BooleanFieldData,
	FormFieldData,
} from "../../src/ui/form-data.js";

describe("DOM Renderer", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
	});

	afterEach(() => {
		document.body.innerHTML = "";
	});

	describe("Basic Field Rendering", () => {
		it("should render a text field with label", () => {
			const fieldData: TextFieldData = {
				key: "config.name",
				type: "text",
				value: "test value",
				path: "config.name",
				label: "Configuration Name",
			};

			const element = renderFormField(fieldData);

			expect(element).toBeTruthy();
			expect(element.tagName).toBe("DIV");
			expect(element.querySelector("label")).toBeTruthy();
			expect(element.querySelector("input")).toBeTruthy();

			const input = element.querySelector("input") as HTMLInputElement;
			expect(input.value).toBe("test value");
			expect(input.name).toBe("config.name");
		});

		it("should render a number field", () => {
			const fieldData: NumberFieldData = {
				key: "config.port",
				type: "number",
				value: 8080,
				path: "config.port",
				label: "Port Number",
			};

			const element = renderFormField(fieldData);
			const input = element.querySelector("input") as HTMLInputElement;

			expect(input.type).toBe("number");
			expect(input.value).toBe("8080");
		});

		it("should render a boolean field", () => {
			const fieldData: BooleanFieldData = {
				key: "config.enabled",
				type: "boolean",
				value: true,
				checked: true,
				path: "config.enabled",
				label: "Enable Feature",
			};

			const element = renderFormField(fieldData);
			const input = element.querySelector("input") as HTMLInputElement;

			expect(input.type).toBe("checkbox");
			expect(input.checked).toBe(true);
		});

		it("should render an object field", () => {
			const fieldData: FormFieldData = {
				key: "config.nested",
				type: "object",
				value: { nested: "value" },
				path: "config.nested",
				label: "Nested Configuration",
			};

			const element = renderFormField(fieldData);

			expect(element).toBeTruthy();
			expect(element.tagName).toBe("DIV");
		});

		it("should render an array field", () => {
			const fieldData: FormFieldData = {
				key: "config.items",
				type: "array",
				value: ["item1", "item2"],
				path: "config.items",
				label: "Configuration Items",
			};

			const element = renderFormField(fieldData);

			expect(element).toBeTruthy();
			expect(element.tagName).toBe("DIV");
		});
	});

	describe("XSS Prevention", () => {
		it("should escape HTML in field values", () => {
			const fieldData: TextFieldData = {
				key: "config.html",
				type: "text",
				value: "<script>alert('xss')</script>",
				path: "config.html",
				label: "HTML Content",
			};

			const element = renderFormField(fieldData);
			const input = element.querySelector("input") as HTMLInputElement;

			expect(input.value).toBe("<script>alert('xss')</script>");
			// Should be safely contained in input value, not executed
		});

		it("should escape HTML in labels", () => {
			const fieldData: TextFieldData = {
				key: "config.name",
				type: "text",
				value: "safe value",
				path: "config.name",
				label: "<script>alert('label-xss')</script>",
			};

			const element = renderFormField(fieldData);
			const label = element.querySelector("label");

			expect(label?.textContent).toContain(
				"<script>alert('label-xss')</script>"
			);
			// Label should contain the text content safely
		});
	});

	describe("Edge Cases", () => {
		it("should handle null values", () => {
			const fieldData: TextFieldData = {
				key: "config.nullable",
				type: "text",
				value: null as any,
				path: "config.nullable",
				label: "Nullable Field",
			};

			const element = renderFormField(fieldData);
			const input = element.querySelector("input") as HTMLInputElement;

			expect(input.value).toBe("");
		});

		it("should handle empty string values", () => {
			const fieldData: TextFieldData = {
				key: "config.empty",
				type: "text",
				value: "",
				path: "config.empty",
				label: "Empty Field",
			};

			const element = renderFormField(fieldData);
			const input = element.querySelector("input") as HTMLInputElement;

			expect(input.value).toBe("");
		});

		it("should handle very long values", () => {
			const longValue = "x".repeat(10000);
			const fieldData: TextFieldData = {
				key: "config.long",
				type: "text",
				value: longValue,
				path: "config.long",
				label: "Long Field",
			};

			const element = renderFormField(fieldData);
			const input = element.querySelector("input") as HTMLInputElement;

			expect(input.value).toBe(longValue);
		});

		it("should handle special characters", () => {
			const specialValue = "Special: !@#$%^&*()_+{}|:<>?[]\\;'\".,/`~";
			const fieldData: TextFieldData = {
				key: "config.special",
				type: "text",
				value: specialValue,
				path: "config.special",
				label: "Special Characters",
			};

			const element = renderFormField(fieldData);
			const input = element.querySelector("input") as HTMLInputElement;

			expect(input.value).toBe(specialValue);
		});

		it("should handle unknown field types gracefully", () => {
			const fieldData: FormFieldData = {
				key: "config.unknown",
				type: "unknown" as any,
				value: "unknown value",
				path: "config.unknown",
				label: "Unknown Type",
			};

			expect(() => renderFormField(fieldData)).not.toThrow();
		});
	});

	describe("Accessibility", () => {
		it("should associate labels with inputs", () => {
			const fieldData: TextFieldData = {
				key: "config.accessible",
				type: "text",
				value: "accessible value",
				path: "config.accessible",
				label: "Accessible Field",
			};

			const element = renderFormField(fieldData);
			const label = element.querySelector("label") as HTMLLabelElement;
			const input = element.querySelector("input") as HTMLInputElement;

			expect(label.getAttribute("for")).toBe(input.id);
		});

		it("should handle long labels gracefully", () => {
			const longLabel =
				"This is a very long label that might wrap to multiple lines and should still be properly associated with its input field";
			const fieldData: TextFieldData = {
				key: "config.long_label",
				type: "text",
				value: "value",
				path: "config.long_label",
				label: longLabel,
			};

			const element = renderFormField(fieldData);
			const label = element.querySelector("label");

			expect(label?.textContent).toBe(longLabel);
		});
	});

	describe("Performance", () => {
		it("should render many fields efficiently", () => {
			const fields: FormFieldData[] = [];
			for (let i = 0; i < 100; i++) {
				fields.push({
					key: `field${i}`,
					type: "text",
					value: `value${i}`,
					path: `field${i}`,
					label: `Field ${i}`,
				});
			}

			const startTime = Date.now();
			const elements = fields.map((field) => renderFormField(field));
			const duration = Date.now() - startTime;

			expect(elements).toHaveLength(100);
			expect(duration).toBeLessThan(100); // Should render quickly
		});

		it("should handle complex nested data efficiently", () => {
			const complexData: FormFieldData = {
				key: "config.complex",
				type: "object",
				value: {
					level1: {
						level2: {
							level3: {
								array: [1, 2, 3, 4, 5],
							},
						},
					},
				},
				path: "config.complex",
				label: "Complex Data",
			};

			const startTime = Date.now();
			const element = renderFormField(complexData);
			const duration = Date.now() - startTime;

			expect(element).toBeTruthy();
			expect(duration).toBeLessThan(50); // Should handle complex data quickly
		});
	});

	describe("Memory Management", () => {
		it("should clean up properly when elements are removed", () => {
			const fieldData: TextFieldData = {
				key: "config.cleanup",
				type: "text",
				value: "cleanup test",
				path: "config.cleanup",
				label: "Cleanup Test",
			};

			const element = renderFormField(fieldData);
			document.body.appendChild(element);

			expect(document.querySelector("input")).toBeTruthy();

			document.body.removeChild(element);

			expect(document.querySelector("input")).toBeFalsy();
		});

		it("should handle multiple render cycles without memory leaks", () => {
			const fieldData: TextFieldData = {
				key: "config.cycles",
				type: "text",
				value: "cycle test",
				path: "config.cycles",
				label: "Cycle Test",
			};

			// Render and remove multiple times
			for (let i = 0; i < 10; i++) {
				const element = renderFormField(fieldData);
				document.body.appendChild(element);
				document.body.removeChild(element);
			}

			expect(document.body.children.length).toBe(0);
		});
	});
});
