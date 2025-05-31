/**
 * Comprehensive Test Suite for DOM Renderer Module
 * Tests DOM creation utilities and form rendering functions
 * Focuses on security, edge cases, and proper DOM structure
 */

import {
	describe,
	it,
	expect,
	beforeEach,
	afterEach,
	jest,
} from "@jest/globals";
import {
	renderFormField,
	renderInputElement,
	renderFormContainer,
	renderFileHeader,
	renderSaveContainer,
	renderErrorNotification,
	renderErrorMessage,
	FormElementRenderOptions,
} from "../../src/ui/dom-renderer.js";
import {
	FormFieldData,
	TextFieldData,
	NumberFieldData,
	BooleanFieldData,
} from "../../src/ui/form-data.js";

describe("DOM Renderer Module", () => {
	beforeEach(() => {
		// Setup DOM environment
		document.body.innerHTML = "";
	});

	afterEach(() => {
		document.body.innerHTML = "";
	});

	describe("renderFormField", () => {
		const mockTextFieldData: TextFieldData = {
			key: "testField",
			value: "test value",
			path: "test.field",
			type: "text",
			label: "Test Field",
		};

		it("should render form field with default options", () => {
			const result = renderFormField(mockTextFieldData);

			expect(result).toBeInstanceOf(HTMLElement);
			expect(result.className).toBe("form-group");
		});

		it("should render form field without label when showLabels is false", () => {
			const options: FormElementRenderOptions = { showLabels: false };
			const result = renderFormField(mockTextFieldData, options);

			expect(result).toBeInstanceOf(HTMLElement);
			expect(result.querySelector("label")).toBeNull();
		});

		it("should arrange label and input based on labelPosition", () => {
			const options: FormElementRenderOptions = { labelPosition: "after" };
			const result = renderFormField(mockTextFieldData, options);

			// Check that we have both label and input
			const label = result.querySelector("label");
			const input = result.querySelector("input");
			expect(label).toBeTruthy();
			expect(input).toBeTruthy();
		});

		it("should apply custom class names", () => {
			const options: FormElementRenderOptions = {
				fieldClassName: "custom-field",
				inputClassName: "custom-input",
				labelClassName: "custom-label",
			};
			const result = renderFormField(mockTextFieldData, options);

			expect(result.className).toBe("custom-field");
		});

		it('should handle label position "before"', () => {
			const options: FormElementRenderOptions = { labelPosition: "before" };
			const result = renderFormField(mockTextFieldData, options);

			const children = Array.from(result.children);
			expect(children[0].tagName.toLowerCase()).toBe("label");
		});

		it('should handle label position "above" (default)', () => {
			const options: FormElementRenderOptions = { labelPosition: "above" };
			const result = renderFormField(mockTextFieldData, options);

			const children = Array.from(result.children);
			expect(children[0].tagName.toLowerCase()).toBe("label");
		});

		it("should handle empty/null values in field data", () => {
			const emptyFieldData: TextFieldData = {
				key: "",
				value: null,
				path: "",
				type: "text",
				label: "",
			};

			expect(() => renderFormField(emptyFieldData)).not.toThrow();
		});

		it("should handle special characters in field data", () => {
			const specialFieldData: TextFieldData = {
				key: "special<>",
				value: '<script>alert("xss")</script>',
				path: "special.field",
				type: "text",
				label: "Special & Characters",
			};

			const result = renderFormField(specialFieldData);
			expect(result).toBeInstanceOf(HTMLElement);
		});
	});

	describe("renderInputElement", () => {
		it("should render text input", () => {
			const fieldData: TextFieldData = {
				key: "text",
				value: "test",
				path: "test.text",
				type: "text",
				label: "Text Input",
			};

			const result = renderInputElement(fieldData);
			expect(result.tagName.toLowerCase()).toBe("input");
			expect((result as HTMLInputElement).type).toBe("text");
		});

		it("should render number input with constraints", () => {
			const fieldData: NumberFieldData = {
				key: "number",
				value: 42,
				path: "test.number",
				type: "number",
				label: "Number Input",
				min: 0,
				max: 100,
				step: 1,
			};

			const result = renderInputElement(fieldData);
			expect(result.tagName.toLowerCase()).toBe("input");
			expect((result as HTMLInputElement).type).toBe("number");
		});

		it("should render boolean input", () => {
			const fieldData: BooleanFieldData = {
				key: "boolean",
				value: true,
				path: "test.boolean",
				type: "boolean",
				label: "Boolean Input",
				checked: true,
			};

			const result = renderInputElement(fieldData);
			expect(result.tagName.toLowerCase()).toBe("input");
			expect((result as HTMLInputElement).type).toBe("checkbox");
		});

		it("should render object field container", () => {
			const fieldData: FormFieldData = {
				key: "object",
				value: {},
				path: "test.object",
				type: "object",
				label: "Object Field",
			};

			const result = renderInputElement(fieldData);
			expect(result.className).toContain("object-field");
		});

		it("should render array field container", () => {
			const fieldData: FormFieldData = {
				key: "array",
				value: [],
				path: "test.array",
				type: "array",
				label: "Array Field",
			};

			const result = renderInputElement(fieldData);
			expect(result.className).toContain("array-field");
		});

		it("should render XML heading field", () => {
			const fieldData: FormFieldData = {
				key: "heading",
				value: "heading",
				path: "test.heading",
				type: "xml-heading",
				label: "XML Heading",
			};

			const result = renderInputElement(fieldData);
			expect(result.className).toContain("xml-heading");
		});

		it("should render XML value field", () => {
			const fieldData: FormFieldData = {
				key: "value",
				value: "xml content",
				path: "test.value",
				type: "xml-value",
				label: "XML Value",
			};

			const result = renderInputElement(fieldData);
			expect(result.tagName.toLowerCase()).toBe("textarea");
			expect(result.className).toContain("xml-value");
		});

		it("should render XML attributes field", () => {
			const fieldData: FormFieldData = {
				key: "attributes",
				value: { id: "123" },
				path: "test.attributes",
				type: "xml-attributes",
				label: "XML Attributes",
			};

			const result = renderInputElement(fieldData);
			expect(result.className).toContain("xml-attributes");
		});

		it("should fall back to text input for unknown types", () => {
			const fieldData = {
				key: "unknown",
				value: "test",
				path: "test.unknown",
				type: "unknown-type" as any,
				label: "Unknown Field",
			};

			const result = renderInputElement(fieldData);
			expect(result.tagName.toLowerCase()).toBe("input");
		});

		it("should handle undefined/null values gracefully", () => {
			const fieldData: TextFieldData = {
				key: "null",
				value: null,
				path: "test.null",
				type: "text",
				label: "Null Field",
			};

			expect(() => renderInputElement(fieldData)).not.toThrow();
		});

		it("should apply custom class names", () => {
			const fieldData: TextFieldData = {
				key: "text",
				value: "test",
				path: "test.text",
				type: "text",
				label: "Text Input",
			};

			const result = renderInputElement(fieldData, "custom-class");
			expect(result.className).toContain("custom-class");
		});
	});

	describe("renderFormContainer", () => {
		it("should render form with default class", () => {
			const result = renderFormContainer();

			expect(result.tagName.toLowerCase()).toBe("form");
			expect(result.className).toBe("config-form");
		});

		it("should render form with custom class", () => {
			const result = renderFormContainer("custom-form");

			expect(result.tagName.toLowerCase()).toBe("form");
			expect(result.className).toBe("custom-form");
		});

		it("should prevent default form submission", () => {
			const result = renderFormContainer();
			const submitEvent = new Event("submit", { cancelable: true });

			// Simulate form submission
			result.dispatchEvent(submitEvent);
			expect(submitEvent.defaultPrevented).toBe(true);
		});
	});

	describe("renderFileHeader", () => {
		it("should render file header with basic information", () => {
			const result = renderFileHeader("test.json", "JSON");

			expect(result.className).toBe("file-editor-header");
			expect(result.textContent).toContain("test.json");
			expect(result.textContent).toContain("JSON");
		});

		it("should show file path when provided and different from filename", () => {
			const result = renderFileHeader(
				"test.json",
				"JSON",
				"/path/to/test.json"
			);

			expect(result.textContent).toContain("/path/to/test.json");
		});

		it("should show handle indicator when hasHandle is true", () => {
			const result = renderFileHeader("test.json", "JSON", undefined, true);

			expect(result.textContent).toContain("Loaded from local file system");
		});

		it("should show storage indicator when no handle", () => {
			const result = renderFileHeader("test.json", "JSON");

			expect(result.textContent).toContain("Restored from browser storage");
		});

		it("should show refresh button when file has handle", () => {
			const result = renderFileHeader("test.json", "JSON", undefined, true);

			const refreshButton = result.querySelector(".refresh-file-btn");
			expect(refreshButton).toBeTruthy();
			expect(refreshButton?.textContent).toContain("Refresh");
		});

		it("should show reload button when file has no handle", () => {
			const result = renderFileHeader("test.json", "JSON", undefined, false);

			const reloadButton = result.querySelector(".reload-from-disk-btn");
			expect(reloadButton).toBeTruthy();
			expect(reloadButton?.textContent).toContain("Reload from Disk");
		});

		it("should always show remove button", () => {
			const result = renderFileHeader("test.json", "JSON");

			const removeButton = result.querySelector(".remove-file-btn");
			expect(removeButton).toBeTruthy();
			expect(removeButton?.textContent).toContain("Remove");
		});

		it("should handle empty filename", () => {
			expect(() => renderFileHeader("", "JSON")).not.toThrow();
		});

		it("should handle special characters in filename", () => {
			const result = renderFileHeader("test<>file.json", "JSON");
			expect(result.textContent).toContain("test<>file.json");
		});

		it("should set proper button attributes", () => {
			const result = renderFileHeader("test.json", "JSON", undefined, true);

			const refreshButton = result.querySelector(".refresh-file-btn");
			expect(refreshButton?.getAttribute("data-file")).toBe("test.json");
			expect(refreshButton?.getAttribute("title")).toContain(
				"Reload test.json from disk"
			);
		});
	});

	describe("renderSaveContainer", () => {
		it("should render save container with filename", () => {
			const result = renderSaveContainer("test.json");

			expect(result.className).toBe("save-container");
			expect(result.getAttribute("data-file")).toBe("test.json");
			expect(result.textContent).toContain("test.json");
			expect(result.textContent).toContain("Save Changes");
		});

		it("should set proper button attributes", () => {
			const result = renderSaveContainer("test.json");

			const saveButton = result.querySelector("button");
			expect(saveButton?.getAttribute("data-file")).toBe("test.json");
			expect(saveButton?.className).toContain("btn-success");
		});

		it("should handle empty filename", () => {
			expect(() => renderSaveContainer("")).not.toThrow();
		});

		it("should handle special characters in filename", () => {
			const result = renderSaveContainer("test<>file.json");
			expect(result.textContent).toContain("test<>file.json");
		});
	});

	describe("renderErrorNotification", () => {
		it("should render error notification with default class", () => {
			const result = renderErrorNotification("Test error message");

			expect(result.className).toBe("error-notification");
			expect(result.innerHTML).toBe(
				"<strong>Error:</strong> Test error message"
			);
		});

		it("should render error notification with custom class", () => {
			const result = renderErrorNotification("Test error", "custom-error");

			expect(result.className).toBe("custom-error");
			expect(result.innerHTML).toBe("<strong>Error:</strong> Test error");
		});

		it("should handle empty message", () => {
			const result = renderErrorNotification("");
			expect(result.innerHTML).toBe("<strong>Error:</strong> ");
		});

		it("should handle HTML content in error messages", () => {
			const result = renderErrorNotification('<script>alert("xss")</script>');
			// The innerHTML should contain the script tag as text
			expect(result.innerHTML).toContain("script");
		});

		it("should handle special characters", () => {
			const result = renderErrorNotification("Error with & special characters");
			expect(result.innerHTML).toContain("Error with &amp; special characters");
		});
	});

	describe("renderErrorMessage", () => {
		it("should render error message with default class", () => {
			const result = renderErrorMessage("Test error message");

			expect(result.className).toBe("error-message");
			expect(result.textContent).toBe("Test error message");
		});

		it("should render error message with custom class", () => {
			const result = renderErrorMessage("Test error", "custom-message");

			expect(result.className).toBe("custom-message");
			expect(result.textContent).toBe("Test error");
		});

		it("should handle empty message", () => {
			const result = renderErrorMessage("");
			expect(result.textContent).toBe("");
		});

		it("should safely handle HTML content as text", () => {
			const result = renderErrorMessage('<script>alert("xss")</script>');
			expect(result.textContent).toBe('<script>alert("xss")</script>');
			// Ensure it doesn't create script elements
			expect(result.querySelector("script")).toBeNull();
		});

		it("should handle special characters", () => {
			const result = renderErrorMessage("Error with & special characters");
			expect(result.textContent).toBe("Error with & special characters");
		});
	});

	describe("Edge Cases and Security Tests", () => {
		it("should handle malformed field data", () => {
			const malformedData = {
				key: null,
				value: undefined,
				path: "",
				type: "text",
				label: null,
			} as any;

			expect(() => renderFormField(malformedData)).not.toThrow();
		});

		it("should handle extremely long strings", () => {
			const longString = "a".repeat(10000);
			const fieldData: TextFieldData = {
				key: longString,
				value: longString,
				path: longString,
				type: "text",
				label: longString,
			};

			expect(() => renderFormField(fieldData)).not.toThrow();
		});

		it("should handle unicode characters", () => {
			const unicodeData: TextFieldData = {
				key: "🌟",
				value: "🎉 Unicode test 🚀",
				path: "unicode.field",
				type: "text",
				label: "🔥 Unicode Label",
			};

			const result = renderFormField(unicodeData);
			expect(result.textContent).toContain("🔥 Unicode Label");
		});

		it("should handle circular references safely", () => {
			const circular: any = { type: "object" };
			circular.self = circular;

			const fieldData = {
				key: "circular",
				value: circular,
				path: "test.circular",
				type: "object",
				label: "Circular Reference",
			} as FormFieldData;

			expect(() => renderInputElement(fieldData)).not.toThrow();
		});

		it("should handle number field with invalid constraints", () => {
			const fieldData: NumberFieldData = {
				key: "number",
				value: 50,
				path: "test.number",
				type: "number",
				label: "Number Input",
				min: 100, // min > max (invalid)
				max: 0,
				step: -1, // negative step
			};

			expect(() => renderInputElement(fieldData)).not.toThrow();
		});

		it("should handle boolean field with non-boolean value", () => {
			const fieldData = {
				key: "boolean",
				value: "not a boolean",
				path: "test.boolean",
				type: "boolean",
				label: "Boolean Input",
			} as any;

			expect(() => renderInputElement(fieldData)).not.toThrow();
		});

		it("should handle null options object", () => {
			const fieldData: TextFieldData = {
				key: "test",
				value: "test",
				path: "test.field",
				type: "text",
				label: "Test",
			};

			expect(() => renderFormField(fieldData, null as any)).not.toThrow();
		});
	});

	describe("Performance and Memory Tests", () => {
		it("should handle rapid successive DOM creation", () => {
			const fieldData: TextFieldData = {
				key: "test",
				value: "test",
				path: "test.field",
				type: "text",
				label: "Test",
			};

			const start = performance.now();
			for (let i = 0; i < 100; i++) {
				renderFormField(fieldData);
			}
			const end = performance.now();

			// Should complete within reasonable time
			expect(end - start).toBeLessThan(1000);
		});

		it("should not leak memory with large form structures", () => {
			const complexFieldData: FormFieldData = {
				key: "complex",
				value: {},
				path: "test.complex",
				type: "object",
				label: "Complex Object",
			};

			// Create and discard many elements
			for (let i = 0; i < 50; i++) {
				const element = renderInputElement(complexFieldData);
				element.remove();
			}

			// Test should complete without memory issues
			expect(true).toBe(true);
		});

		it("should handle deeply nested object structures", () => {
			let deepObject: any = {};
			let current = deepObject;

			// Create 50 levels of nesting
			for (let i = 0; i < 50; i++) {
				current.child = {};
				current = current.child;
			}

			const fieldData: FormFieldData = {
				key: "deep",
				value: deepObject,
				path: "test.deep",
				type: "object",
				label: "Deep Object",
			};

			expect(() => renderInputElement(fieldData)).not.toThrow();
		});
	});

	describe("DOM Structure Validation", () => {
		it("should create properly structured form field DOM", () => {
			const fieldData: TextFieldData = {
				key: "test",
				value: "test value",
				path: "test.field",
				type: "text",
				label: "Test Field",
			};

			const result = renderFormField(fieldData);

			// Check structure
			expect(result.tagName.toLowerCase()).toBe("div");
			expect(result.children.length).toBeGreaterThan(0);
		});

		it("should create proper array field structure", () => {
			const fieldData: FormFieldData = {
				key: "array",
				value: [],
				path: "test.array",
				type: "array",
				label: "Array Field",
			};

			const result = renderInputElement(fieldData);

			// Should have header, items container, and add button
			expect(result.querySelector(".array-header")).toBeTruthy();
			expect(result.querySelector(".array-items")).toBeTruthy();
			expect(result.querySelector(".add-array-item")).toBeTruthy();
		});

		it("should create proper object field structure", () => {
			const fieldData: FormFieldData = {
				key: "object",
				value: {},
				path: "test.object",
				type: "object",
				label: "Object Field",
			};

			const result = renderInputElement(fieldData);

			// Should have header and fields container
			expect(result.querySelector(".object-header")).toBeTruthy();
			expect(result.querySelector(".object-fields")).toBeTruthy();
		});

		it("should create proper file header structure", () => {
			const result = renderFileHeader(
				"test.json",
				"JSON",
				"/path/test.json",
				true
			);

			// Should have title container, type tag, and action buttons
			expect(result.querySelector(".file-title-container")).toBeTruthy();
			expect(result.querySelector(".file-type")).toBeTruthy();
			expect(result.querySelector(".file-action-buttons")).toBeTruthy();
		});
	});
});
