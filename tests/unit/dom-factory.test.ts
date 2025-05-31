/**
 * Unit tests for DOM Factory module
 * Tests pure DOM creation functions
 */

import {
	createElement,
	createInput,
	createButton,
	createForm,
	createTextarea,
	createLabel,
	ElementConfig,
	InputConfig,
	ButtonConfig,
	FormConfig,
} from "../../src/ui/dom-factory";

describe("DOM Factory", () => {
	describe("createElement", () => {
		it("should create basic element with tag", () => {
			const config: ElementConfig = { tag: "div" };
			const element = createElement(config);

			expect(element.tagName.toLowerCase()).toBe("div");
		});

		it("should create element with className", () => {
			const config: ElementConfig = {
				tag: "div",
				className: "test-class",
			};
			const element = createElement(config);

			expect(element.className).toBe("test-class");
		});

		it("should create element with textContent", () => {
			const config: ElementConfig = {
				tag: "span",
				textContent: "Hello World",
			};
			const element = createElement(config);

			expect(element.textContent).toBe("Hello World");
		});

		it("should create element with attributes", () => {
			const config: ElementConfig = {
				tag: "div",
				attributes: { "data-test": "value", id: "test-id" },
			};
			const element = createElement(config);

			expect(element.getAttribute("data-test")).toBe("value");
			expect(element.getAttribute("id")).toBe("test-id");
		});

		it("should create element with data attributes", () => {
			const config: ElementConfig = {
				tag: "div",
				data: { file: "test.json", index: "0" },
			};
			const element = createElement(config);

			expect(element.getAttribute("data-file")).toBe("test.json");
			expect(element.getAttribute("data-index")).toBe("0");
		});
	});

	describe("createInput", () => {
		it("should create input with type and value", () => {
			const config: InputConfig = {
				tag: "input",
				type: "text",
				value: "test value",
			};
			const input = createInput(config) as HTMLInputElement;

			expect(input.type).toBe("text");
			expect(input.value).toBe("test value");
		});

		it("should create checkbox input with checked state", () => {
			const config: InputConfig = {
				tag: "input",
				type: "checkbox",
				checked: true,
			};
			const input = createInput(config) as HTMLInputElement;

			expect(input.type).toBe("checkbox");
			expect(input.checked).toBe(true);
		});

		it("should create input with placeholder", () => {
			const config: InputConfig = {
				tag: "input",
				type: "text",
				placeholder: "Enter value...",
			};
			const input = createInput(config) as HTMLInputElement;

			expect(input.placeholder).toBe("Enter value...");
		});
	});

	describe("createButton", () => {
		it("should create button with text and type", () => {
			const config: ButtonConfig = {
				tag: "button",
				textContent: "Click Me",
				type: "submit",
			};
			const button = createButton(config) as HTMLButtonElement;

			expect(button.textContent).toBe("Click Me");
			expect(button.type).toBe("submit");
		});

		it("should create disabled button", () => {
			const config: ButtonConfig = {
				tag: "button",
				disabled: true,
			};
			const button = createButton(config) as HTMLButtonElement;

			expect(button.disabled).toBe(true);
		});
	});

	describe("createForm", () => {
		it("should create form element", () => {
			const config: FormConfig = { tag: "form" };
			const form = createForm(config);

			expect(form.tagName.toLowerCase()).toBe("form");
		});
	});

	describe("createTextarea", () => {
		it("should create textarea with value and rows", () => {
			const config = {
				tag: "textarea",
				value: "Test content",
				rows: 5,
				className: "test-class",
			};
			const textarea = createTextarea(config) as HTMLTextAreaElement;

			expect(textarea.tagName.toLowerCase()).toBe("textarea");
			expect(textarea.value).toBe("Test content");
			expect(textarea.rows).toBe(5);
			expect(textarea.className).toBe("test-class");
		});

		it("should create textarea with default values", () => {
			const config = { tag: "textarea" };
			const textarea = createTextarea(config) as HTMLTextAreaElement;

			expect(textarea.value).toBe("");
			expect(textarea.rows).toBe(2); // Default rows
		});
	});

	describe("createLabel", () => {
		it("should create label with text", () => {
			const config = {
				tag: "label",
				textContent: "Test Label",
				className: "form-label",
			};
			const label = createLabel(config);

			expect(label.tagName.toLowerCase()).toBe("label");
			expect(label.textContent).toBe("Test Label");
			expect(label.className).toBe("form-label");
		});

		it("should create label with for attribute", () => {
			const config = {
				tag: "label",
				textContent: "Test Label",
				for: "input-id",
			};
			const label = createLabel(config);

			expect(label.getAttribute("for")).toBe("input-id");
		});
	});
});
