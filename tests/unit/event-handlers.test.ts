/**
 * Unit tests for Event Handlers module
 * Tests event handling setup and utilities
 */

import {
	setupFieldEventListeners,
	setupFileActionEventListeners,
	setupSaveEventListeners,
	setupFormEventListeners,
	getFieldValueFromElement,
	setFieldValueInElement,
	FormEventHandlers,
} from "../../src/ui/event-handlers";
import { FormFieldData } from "../../src/ui/form-data";

// Mock DOM elements for testing
function createMockInput(
	type: string = "text",
	value: string = ""
): HTMLInputElement {
	const input = document.createElement("input");
	input.type = type;
	input.value = value;
	return input;
}

function createMockTextarea(value: string = ""): HTMLTextAreaElement {
	const textarea = document.createElement("textarea");
	textarea.value = value;
	return textarea;
}

function createMockFieldElement(
	_fieldType: string,
	inputElement: HTMLElement
): HTMLElement {
	const container = document.createElement("div");
	container.appendChild(inputElement);
	return container;
}

describe("Event Handlers", () => {
	let mockHandlers: FormEventHandlers;

	beforeEach(() => {
		mockHandlers = {
			onFieldChange: jest.fn(),
			onArrayItemAdd: jest.fn(),
			onArrayItemRemove: jest.fn(),
			onFileRemove: jest.fn(),
			onFileRefresh: jest.fn(),
			onFileReload: jest.fn(),
			onFileSave: jest.fn(),
		};
	});

	describe("setupFieldEventListeners", () => {
		it("should setup input event listeners for text fields", () => {
			const input = createMockInput("text", "initial");
			const element = createMockFieldElement("text", input);
			const fieldData: FormFieldData = {
				key: "test",
				value: "initial",
				path: "test.path",
				type: "text",
				label: "Test",
			};

			setupFieldEventListeners(element, fieldData, mockHandlers);

			// Simulate input event
			input.value = "changed";
			input.dispatchEvent(new Event("input"));

			// Should be debounced, so wait for it
			setTimeout(() => {
				expect(mockHandlers.onFieldChange).toHaveBeenCalledWith(
					"test.path",
					"changed",
					"text"
				);
			}, 350);
		});

		it("should setup checkbox event listeners for boolean fields", () => {
			const checkbox = createMockInput("checkbox");
			const element = createMockFieldElement("boolean", checkbox);
			const fieldData: FormFieldData = {
				key: "enabled",
				value: false,
				path: "config.enabled",
				type: "boolean",
				label: "Enabled",
			};

			setupFieldEventListeners(element, fieldData, mockHandlers);

			// Simulate change event
			checkbox.checked = true;
			checkbox.dispatchEvent(new Event("change"));

			expect(mockHandlers.onFieldChange).toHaveBeenCalledWith(
				"config.enabled",
				true,
				"boolean"
			);
		});

		it("should setup textarea event listeners for XML value fields", () => {
			const textarea = createMockTextarea("initial content");
			const element = createMockFieldElement("xml-value", textarea);
			const fieldData: FormFieldData = {
				key: "content",
				value: "initial content",
				path: "xml.content",
				type: "xml-value",
				label: "Content",
			};

			setupFieldEventListeners(element, fieldData, mockHandlers);

			// Simulate input event
			textarea.value = "updated content";
			textarea.dispatchEvent(new Event("input"));

			setTimeout(() => {
				expect(mockHandlers.onFieldChange).toHaveBeenCalledWith(
					"xml.content",
					"updated content",
					"xml-value"
				);
			}, 350);
		});

		it("should handle number fields correctly", () => {
			const input = createMockInput("number", "42");
			const element = createMockFieldElement("number", input);
			const fieldData: FormFieldData = {
				key: "count",
				value: 42,
				path: "config.count",
				type: "number",
				label: "Count",
			};

			setupFieldEventListeners(element, fieldData, mockHandlers);

			// Simulate blur event
			input.value = "100";
			input.dispatchEvent(new Event("blur"));

			expect(mockHandlers.onFieldChange).toHaveBeenCalledWith(
				"config.count",
				100,
				"number"
			);
		});
	});

	describe("setupFileActionEventListeners", () => {
		it("should setup remove file button listener", () => {
			const header = document.createElement("div");
			const removeButton = document.createElement("button");
			removeButton.className = "remove-file-btn";
			header.appendChild(removeButton);

			setupFileActionEventListeners(header, "test.json", mockHandlers);

			removeButton.click();

			expect(mockHandlers.onFileRemove).toHaveBeenCalledWith("test.json");
		});

		it("should setup refresh file button listener", () => {
			const header = document.createElement("div");
			const refreshButton = document.createElement("button");
			refreshButton.className = "refresh-file-btn";
			header.appendChild(refreshButton);

			setupFileActionEventListeners(header, "test.json", mockHandlers);

			refreshButton.click();

			expect(mockHandlers.onFileRefresh).toHaveBeenCalledWith("test.json");
		});

		it("should setup reload from disk button listener", () => {
			const header = document.createElement("div");
			const reloadButton = document.createElement("button");
			reloadButton.className = "reload-from-disk-btn";
			header.appendChild(reloadButton);

			setupFileActionEventListeners(header, "test.json", mockHandlers);

			reloadButton.click();

			expect(mockHandlers.onFileReload).toHaveBeenCalledWith("test.json");
		});
	});

	describe("setupSaveEventListeners", () => {
		it("should setup save button listener", () => {
			const saveContainer = document.createElement("div");
			const saveButton = document.createElement("button");
			saveContainer.appendChild(saveButton);

			setupSaveEventListeners(saveContainer, "test.json", mockHandlers);

			saveButton.click();

			expect(mockHandlers.onFileSave).toHaveBeenCalledWith("test.json");
		});
	});

	describe("setupFormEventListeners", () => {
		it("should prevent form submission", () => {
			const form = document.createElement("form");

			setupFormEventListeners(form);

			const submitEvent = new Event("submit", { cancelable: true });
			form.dispatchEvent(submitEvent);

			expect(submitEvent.defaultPrevented).toBe(true);
		});
	});

	describe("getFieldValueFromElement", () => {
		it("should get value from text input", () => {
			const input = createMockInput("text", "test value");
			const element = createMockFieldElement("text", input);

			const value = getFieldValueFromElement(element, "text");
			expect(value).toBe("test value");
		});

		it("should get checked state from checkbox", () => {
			const checkbox = createMockInput("checkbox");
			checkbox.checked = true;
			const element = createMockFieldElement("boolean", checkbox);

			const value = getFieldValueFromElement(element, "boolean");
			expect(value).toBe(true);
		});

		it("should get numeric value from number input", () => {
			const input = createMockInput("number", "42");
			const element = createMockFieldElement("number", input);

			const value = getFieldValueFromElement(element, "number");
			expect(value).toBe(42);
		});

		it("should get value from textarea", () => {
			const textarea = createMockTextarea("textarea content");
			const element = createMockFieldElement("xml-value", textarea);

			const value = getFieldValueFromElement(element, "xml-value");
			expect(value).toBe("textarea content");
		});

		it("should return empty string for empty number input", () => {
			const input = createMockInput("number", "");
			const element = createMockFieldElement("number", input);

			const value = getFieldValueFromElement(element, "number");
			expect(value).toBe("");
		});
	});

	describe("setFieldValueInElement", () => {
		it("should set value in text input", () => {
			const input = createMockInput("text");
			const element = createMockFieldElement("text", input);

			setFieldValueInElement(element, "text", "new value");
			expect(input.value).toBe("new value");
		});

		it("should set checked state in checkbox", () => {
			const checkbox = createMockInput("checkbox");
			const element = createMockFieldElement("boolean", checkbox);

			setFieldValueInElement(element, "boolean", true);
			expect(checkbox.checked).toBe(true);
		});

		it("should set numeric value in number input", () => {
			const input = createMockInput("number");
			const element = createMockFieldElement("number", input);

			setFieldValueInElement(element, "number", 100);
			expect(input.value).toBe("100");
		});

		it("should set value in textarea", () => {
			const textarea = createMockTextarea();
			const element = createMockFieldElement("xml-value", textarea);

			setFieldValueInElement(element, "xml-value", "new content");
			expect(textarea.value).toBe("new content");
		});

		it("should handle null/undefined values", () => {
			const input = createMockInput("text");
			const element = createMockFieldElement("text", input);

			setFieldValueInElement(element, "text", null);
			expect(input.value).toBe("null");

			setFieldValueInElement(element, "text", undefined);
			expect(input.value).toBe("undefined");
		});
	});
});
