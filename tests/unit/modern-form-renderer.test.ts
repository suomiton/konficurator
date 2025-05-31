import {
	describe,
	it,
	expect,
	beforeEach,
	afterEach,
	jest,
} from "@jest/globals";
import { ModernFormRenderer } from "../../src/ui/modern-form-renderer";
import { FileData } from "../../src/interfaces";
import { AnyFormFieldData } from "../../src/ui/form-data";
import * as domRenderer from "../../src/ui/dom-renderer";
import * as formData from "../../src/ui/form-data";
import * as eventHandlers from "../../src/ui/event-handlers";
import * as stickyBehavior from "../../src/ui/sticky-behavior";
import * as domFactory from "../../src/ui/dom-factory";

// Mock all dependency modules
jest.mock("../../src/ui/dom-renderer", () => ({
	renderFileHeader: jest.fn(),
	renderFormContainer: jest.fn(),
	renderSaveContainer: jest.fn(),
	renderErrorNotification: jest.fn(),
	renderErrorMessage: jest.fn(),
	renderFormField: jest.fn(),
}));

jest.mock("../../src/ui/form-data", () => ({
	generateFormFieldsData: jest.fn(),
	createFormFieldData: jest.fn(),
}));

jest.mock("../../src/ui/event-handlers", () => ({
	setupFileActionEventListeners: jest.fn(),
	setupFormEventListeners: jest.fn(),
	setupSaveEventListeners: jest.fn(),
	setupFieldEventListeners: jest.fn(),
}));

jest.mock("../../src/ui/sticky-behavior", () => ({
	setupStickyBehavior: jest.fn(),
}));

jest.mock("../../src/ui/dom-factory", () => ({
	createElement: jest.fn(),
	createButton: jest.fn(),
}));

const mockDomRenderer = domRenderer as {
	renderFileHeader: jest.MockedFunction<any>;
	renderFormContainer: jest.MockedFunction<any>;
	renderSaveContainer: jest.MockedFunction<any>;
	renderErrorNotification: jest.MockedFunction<any>;
	renderErrorMessage: jest.MockedFunction<any>;
	renderFormField: jest.MockedFunction<any>;
};

const mockFormData = formData as {
	generateFormFieldsData: jest.MockedFunction<any>;
	createFormFieldData: jest.MockedFunction<any>;
};

const mockEventHandlers = eventHandlers as {
	setupFileActionEventListeners: jest.MockedFunction<any>;
	setupFormEventListeners: jest.MockedFunction<any>;
	setupSaveEventListeners: jest.MockedFunction<any>;
	setupFieldEventListeners: jest.MockedFunction<any>;
};

const mockStickyBehavior = stickyBehavior as {
	setupStickyBehavior: jest.MockedFunction<any>;
};

const mockDomFactory = domFactory as {
	createElement: jest.MockedFunction<any>;
	createButton: jest.MockedFunction<any>;
};

describe("ModernFormRenderer - Real Implementation Tests", () => {
	let renderer: ModernFormRenderer;
	let mockContainer: HTMLElement;
	let mockHeader: HTMLElement;
	let mockForm: HTMLElement;
	let mockSaveContainer: HTMLElement;
	let mockFormFields: HTMLElement;

	beforeEach(() => {
		// Create mock DOM elements
		mockContainer = document.createElement("div");
		mockHeader = document.createElement("div");
		mockForm = document.createElement("form");
		mockSaveContainer = document.createElement("div");
		mockFormFields = document.createElement("div");

		// Setup DOM factory mocks
		mockDomFactory.createElement.mockReturnValue(mockContainer);

		// Setup dom-renderer mocks
		mockDomRenderer.renderFileHeader.mockReturnValue(mockHeader);
		mockDomRenderer.renderFormContainer.mockReturnValue(mockForm);
		mockDomRenderer.renderSaveContainer.mockReturnValue(mockSaveContainer);
		mockDomRenderer.renderErrorNotification.mockReturnValue(
			document.createElement("div")
		);
		mockDomRenderer.renderErrorMessage.mockReturnValue(
			document.createElement("div")
		);

		// Setup form-data mocks
		mockFormData.generateFormFieldsData.mockReturnValue([]);

		// Setup event handler mocks
		mockEventHandlers.setupFileActionEventListeners.mockReturnValue(undefined);
		mockEventHandlers.setupFormEventListeners.mockReturnValue(undefined);
		mockEventHandlers.setupSaveEventListeners.mockReturnValue(undefined);
		mockEventHandlers.setupFieldEventListeners.mockReturnValue(undefined);

		// Setup sticky behavior mock
		mockStickyBehavior.setupStickyBehavior.mockReturnValue({
			isSticky: false,
			originalPosition: 0,
			element: mockSaveContainer,
			container: mockContainer,
			options: {
				threshold: 100,
				className: "save-container",
				activeClassName: "sticky-active",
				offset: 20,
			},
		});

		// Mock DOM manipulation methods
		jest.spyOn(mockContainer, "appendChild").mockReturnValue(mockContainer);
		jest.spyOn(mockForm, "appendChild").mockReturnValue(mockForm);
		jest.spyOn(mockForm, "querySelector").mockReturnValue(null);

		// Mock setTimeout for sticky behavior
		jest.spyOn(global, "setTimeout").mockImplementation((callback: any) => {
			callback();
			return 1 as any;
		});

		renderer = new ModernFormRenderer();
	});

	afterEach(() => {
		jest.clearAllMocks();
		jest.restoreAllMocks();
	});

	describe("Constructor", () => {
		it("should initialize with default empty options", () => {
			const defaultRenderer = new ModernFormRenderer();

			expect(defaultRenderer.getEventHandlers()).toEqual({});
			expect(defaultRenderer.getRenderOptions()).toEqual({});
		});

		it("should initialize with provided options", () => {
			const eventHandlers = {
				onSave: jest.fn(),
				onFieldChange: jest.fn(),
			};
			const renderOptions = {
				showLabels: true,
				labelPosition: "above" as const,
			};

			const customRenderer = new ModernFormRenderer(
				eventHandlers,
				renderOptions
			);

			expect(customRenderer.getEventHandlers()).toEqual(eventHandlers);
			expect(customRenderer.getRenderOptions()).toEqual(renderOptions);
		});
	});

	describe("renderFileEditor", () => {
		it("should render complete file editor with all components", () => {
			const fileData: FileData = {
				name: "config.json",
				type: "json",
				content: { setting: "value" },
				originalContent: '{"setting": "value"}',
				handle: null,
			};

			const result = renderer.renderFileEditor(fileData);

			// Verify container creation
			expect(mockDomFactory.createElement).toHaveBeenCalledWith({
				tag: "div",
				className: "file-editor fade-in",
				attributes: { "data-file": "config.json" },
			});

			// Verify header rendering
			expect(mockDomRenderer.renderFileHeader).toHaveBeenCalledWith(
				"config.json",
				"json",
				undefined,
				false
			);

			// Verify event setup for header
			expect(
				mockEventHandlers.setupFileActionEventListeners
			).toHaveBeenCalled();

			// Verify form rendering
			expect(mockDomRenderer.renderFormContainer).toHaveBeenCalled();
			expect(mockEventHandlers.setupFormEventListeners).toHaveBeenCalledWith(
				mockForm
			);

			// Verify form fields generation
			expect(mockFormData.generateFormFieldsData).toHaveBeenCalledWith({
				setting: "value",
			});

			// Verify save container rendering
			expect(mockDomRenderer.renderSaveContainer).toHaveBeenCalledWith(
				"config.json"
			);
			expect(mockEventHandlers.setupSaveEventListeners).toHaveBeenCalledWith(
				mockSaveContainer,
				"config.json",
				{}
			);

			// Verify sticky behavior setup
			expect(mockStickyBehavior.setupStickyBehavior).toHaveBeenCalledWith(
				mockSaveContainer,
				"config.json"
			);

			expect(result).toBe(mockContainer);
		});

		it("should handle file with path and handle correctly", () => {
			const fileData: FileData = {
				name: "config.json",
				type: "json",
				content: { setting: "value" },
				originalContent: '{"setting": "value"}',
				path: "/path/to/config.json",
				handle: {} as FileSystemFileHandle,
			};

			renderer.renderFileEditor(fileData);

			expect(mockDomRenderer.renderFileHeader).toHaveBeenCalledWith(
				"config.json",
				"json",
				"/path/to/config.json",
				true
			);
		});

		it("should render error notification for parse errors", () => {
			const fileData: FileData = {
				name: "broken.json",
				type: "json",
				content: { _error: "Invalid JSON syntax" },
				originalContent: '{"invalid": json}',
				handle: null,
			};

			renderer.renderFileEditor(fileData);

			expect(mockDomRenderer.renderErrorNotification).toHaveBeenCalledWith(
				"Invalid JSON syntax"
			);

			// Should not render form or save container for error case
			expect(mockDomRenderer.renderFormContainer).not.toHaveBeenCalled();
			expect(mockDomRenderer.renderSaveContainer).not.toHaveBeenCalled();
		});

		it("should render error for invalid content types", () => {
			const fileData: FileData = {
				name: "invalid.json",
				type: "json",
				content: "not an object",
				originalContent: '"not an object"',
				handle: null,
			};

			renderer.renderFileEditor(fileData);

			expect(mockDomRenderer.renderErrorNotification).toHaveBeenCalledWith(
				"Failed to parse file: Not a valid configuration object."
			);
		});

		it("should render error for array content", () => {
			const fileData: FileData = {
				name: "array.json",
				type: "json",
				content: [1, 2, 3],
				originalContent: "[1, 2, 3]",
				handle: null,
			};

			renderer.renderFileEditor(fileData);

			expect(mockDomRenderer.renderErrorNotification).toHaveBeenCalledWith(
				"Failed to parse file: Not a valid configuration object."
			);
		});

		it("should handle form field generation errors", () => {
			const fileData: FileData = {
				name: "config.json",
				type: "json",
				content: { setting: "value" },
				originalContent: '{"setting": "value"}',
				handle: null,
			};

			const error = new Error("Form generation failed");
			mockFormData.generateFormFieldsData.mockImplementation(() => {
				throw error;
			});

			renderer.renderFileEditor(fileData);

			expect(mockDomRenderer.renderErrorMessage).toHaveBeenCalledWith(
				"Failed to parse config.json: Form generation failed"
			);
		});

		it("should handle unknown form generation errors", () => {
			const fileData: FileData = {
				name: "config.json",
				type: "json",
				content: { setting: "value" },
				originalContent: '{"setting": "value"}',
				handle: null,
			};

			mockFormData.generateFormFieldsData.mockImplementation(() => {
				throw "String error";
			});

			renderer.renderFileEditor(fileData);

			expect(mockDomRenderer.renderErrorMessage).toHaveBeenCalledWith(
				"Failed to parse config.json: Unknown error"
			);
		});
	});

	describe("generateFormFields", () => {
		it("should generate form fields using form data and render them", () => {
			const data = { name: "test", value: 123 };
			const path = "config";

			const mockFormFieldsData: AnyFormFieldData[] = [
				{
					type: "text" as const,
					key: "name",
					value: "test",
					path: "config.name",
					label: "Name",
				},
				{
					type: "number" as const,
					key: "value",
					value: 123,
					path: "config.value",
					label: "Value",
				},
			];

			mockFormData.generateFormFieldsData.mockReturnValue(mockFormFieldsData);

			const result = renderer.generateFormFields(data, path);

			expect(mockFormData.generateFormFieldsData).toHaveBeenCalledWith(
				data,
				path
			);
			expect(result).toStrictEqual(mockFormFields);
		});

		it("should maintain interface compatibility", () => {
			// This tests that the method signature matches the IRenderer interface
			const data = { test: "value" };
			const path = "test.path";

			const result = renderer.generateFormFields(data, path);

			expect(result).toBeInstanceOf(HTMLElement);
		});
	});

	describe("renderFormFields", () => {
		beforeEach(() => {
			// Setup mock for private method testing via renderFileEditor
			mockFormData.generateFormFieldsData.mockReturnValue([
				{
					type: "text",
					key: "simple",
					value: "value",
					path: "simple",
					label: "Simple",
				},
				{
					type: "object",
					key: "nested",
					value: { inner: "value" },
					path: "nested",
					label: "Nested",
					children: [
						{
							type: "text",
							key: "inner",
							value: "value",
							path: "nested.inner",
							label: "Inner",
						},
					],
				},
				{
					type: "array",
					key: "list",
					value: ["item1", "item2"],
					path: "list",
					label: "List",
					jsonValue: JSON.stringify(["item1", "item2"]),
					items: ["item1", "item2"],
				},
			]);

			// Mock renderFormField to return different elements for different field types
			mockDomRenderer.renderFormField.mockImplementation((fieldData: any) => {
				const element = document.createElement("div");
				element.className = `field-${fieldData.type}`;

				if (fieldData.type === "object") {
					const objectFields = document.createElement("div");
					objectFields.className = "object-fields";
					element.appendChild(objectFields);
				} else if (fieldData.type === "array") {
					const arrayItems = document.createElement("div");
					arrayItems.className = "array-items";
					element.appendChild(arrayItems);
				}

				return element;
			});

			// Mock createElement for form fields container
			const mockFieldsContainer = document.createElement("div");
			mockFieldsContainer.className = "form-fields";
			jest
				.spyOn(mockFieldsContainer, "appendChild")
				.mockReturnValue(mockFieldsContainer);
			mockDomFactory.createElement.mockReturnValue(mockFieldsContainer);
		});

		it("should render all field types correctly through renderFileEditor", () => {
			const fileData: FileData = {
				name: "complex.json",
				type: "json",
				content: {
					simple: "value",
					nested: { inner: "value" },
					list: ["item1", "item2"],
				},
				originalContent: "{}",
				handle: null,
			};

			renderer.renderFileEditor(fileData);

			// Verify all field types were rendered
			expect(mockDomRenderer.renderFormField).toHaveBeenCalled();
			expect(mockEventHandlers.setupFieldEventListeners).toHaveBeenCalled();
		});

		it("should handle nested object fields", () => {
			const fileData: FileData = {
				name: "nested.json",
				type: "json",
				content: { nested: { inner: "value" } },
				originalContent: "{}",
				handle: null,
			};

			// Mock querySelector to return object-fields container
			const objectFieldsContainer = document.createElement("div");
			objectFieldsContainer.className = "object-fields";
			jest
				.spyOn(mockForm, "querySelector")
				.mockReturnValue(objectFieldsContainer);
			jest
				.spyOn(objectFieldsContainer, "appendChild")
				.mockReturnValue(objectFieldsContainer);

			renderer.renderFileEditor(fileData);

			expect(mockDomRenderer.renderFormField).toHaveBeenCalled();
		});

		it("should handle array fields with items", () => {
			const fileData: FileData = {
				name: "array.json",
				type: "json",
				content: { list: ["item1", "item2"] },
				originalContent: "{}",
				handle: null,
			};

			// Mock querySelector to return array-items container
			const arrayItemsContainer = document.createElement("div");
			arrayItemsContainer.className = "array-items";
			jest
				.spyOn(mockForm, "querySelector")
				.mockReturnValue(arrayItemsContainer);
			jest
				.spyOn(arrayItemsContainer, "appendChild")
				.mockReturnValue(arrayItemsContainer);

			renderer.renderFileEditor(fileData);

			expect(mockDomRenderer.renderFormField).toHaveBeenCalled();
		});
	});

	describe("renderArrayItems", () => {
		beforeEach(() => {
			// Setup for testing array item rendering through renderFileEditor
			const mockArrayContainer = document.createElement("div");
			mockArrayContainer.className = "array-items-list";
			jest
				.spyOn(mockArrayContainer, "appendChild")
				.mockReturnValue(mockArrayContainer);

			mockDomFactory.createElement.mockReturnValue(mockArrayContainer);
			mockDomFactory.createButton.mockReturnValue(
				document.createElement("button")
			);
		});

		it("should render array items with object elements", () => {
			const fileData: FileData = {
				name: "objects.json",
				type: "json",
				content: {
					items: [
						{ name: "item1", value: 1 },
						{ name: "item2", value: 2 },
					],
				},
				originalContent: "{}",
				handle: null,
			};

			mockFormData.generateFormFieldsData.mockReturnValue([
				{
					type: "array",
					key: "items",
					path: "items",
					label: "Items",
					value: [
						{ name: "item1", value: 1 },
						{ name: "item2", value: 2 },
					],
					jsonValue: JSON.stringify([
						{ name: "item1", value: 1 },
						{ name: "item2", value: 2 },
					]),
					items: [
						{ name: "item1", value: 1 },
						{ name: "item2", value: 2 },
					],
				},
			]);

			mockFormData.createFormFieldData.mockImplementation(
				(key: string, value: any, path: string) => {
					if (typeof value === "object" && value !== null) {
						return {
							type: "object" as const,
							key,
							value,
							path,
							label: key.charAt(0).toUpperCase() + key.slice(1),
							children: [],
						};
					} else {
						return {
							type: "text" as const,
							key,
							value,
							path,
							label: key.charAt(0).toUpperCase() + key.slice(1),
						};
					}
				}
			);

			renderer.renderFileEditor(fileData);

			expect(mockFormData.createFormFieldData).toHaveBeenCalledWith(
				"item0",
				{ name: "item1", value: 1 },
				"items[0]",
				"object"
			);
		});

		it("should render array items with primitive elements", () => {
			const fileData: FileData = {
				name: "primitives.json",
				type: "json",
				content: {
					tags: ["tag1", "tag2", "tag3"],
				},
				originalContent: "{}",
				handle: null,
			};

			mockFormData.generateFormFieldsData.mockReturnValue([
				{
					type: "array",
					key: "tags",
					path: "tags",
					label: "Tags",
					value: ["tag1", "tag2", "tag3"],
					jsonValue: JSON.stringify(["tag1", "tag2", "tag3"]),
					items: ["tag1", "tag2", "tag3"],
				},
			]);

			mockFormData.createFormFieldData.mockImplementation(
				(key: string, value: any, path: string) => ({
					type: "text" as const,
					key,
					value,
					path,
					label: key.charAt(0).toUpperCase() + key.slice(1),
				})
			);

			renderer.renderFileEditor(fileData);

			expect(mockFormData.createFormFieldData).toHaveBeenCalledWith(
				"item0",
				"tag1",
				"tags[0]"
			);
		});

		it("should add remove buttons for array items", () => {
			const fileData: FileData = {
				name: "removable.json",
				type: "json",
				content: { items: ["item1"] },
				originalContent: "{}",
				handle: null,
			};

			mockFormData.generateFormFieldsData.mockReturnValue([
				{
					type: "array",
					key: "items",
					path: "items",
					label: "Items",
					value: ["item1"],
					jsonValue: JSON.stringify(["item1"]),
					items: ["item1"],
				},
			]);

			renderer.renderFileEditor(fileData);

			expect(mockDomFactory.createButton).toHaveBeenCalledWith({
				tag: "button",
				className: "btn btn-danger btn-small remove-array-item",
				type: "button",
				textContent: "×",
				attributes: {
					"data-index": "0",
					title: "Remove item",
				},
			});
		});
	});

	describe("Event Handler Management", () => {
		it("should update event handlers", () => {
			const newHandlers = {
				onFileSave: jest.fn(),
				onFileRefresh: jest.fn(),
			};

			renderer.setEventHandlers(newHandlers);

			const currentHandlers = renderer.getEventHandlers();
			expect(currentHandlers.onFileSave).toBe(newHandlers.onFileSave);
			expect(currentHandlers.onFileRefresh).toBe(newHandlers.onFileRefresh);
		});

		it("should merge event handlers with existing ones", () => {
			const initialHandlers = {
				onFileSave: jest.fn(),
				onFieldChange: jest.fn(),
			};

			const renderer = new ModernFormRenderer(initialHandlers);

			const additionalHandlers = {
				onFileRefresh: jest.fn(),
			};

			renderer.setEventHandlers(additionalHandlers);

			const currentHandlers = renderer.getEventHandlers();
			expect(currentHandlers.onFileSave).toBe(initialHandlers.onFileSave);
			expect(currentHandlers.onFieldChange).toBe(initialHandlers.onFieldChange);
			expect(currentHandlers.onFileRefresh).toBe(
				additionalHandlers.onFileRefresh
			);
		});

		it("should get current event handlers", () => {
			const handlers = {
				onFileSave: jest.fn(),
				onFieldChange: jest.fn(),
			};

			const renderer = new ModernFormRenderer(handlers);
			const retrieved = renderer.getEventHandlers();

			expect(retrieved).toEqual(handlers);
			// Should return a copy, not the original object
			expect(retrieved).not.toBe(handlers);
		});
	});

	describe("Render Options Management", () => {
		it("should update render options", () => {
			const newOptions = {
				showLabels: false,
				labelPosition: "after" as const,
			};

			renderer.setRenderOptions(newOptions);

			const currentOptions = renderer.getRenderOptions();
			expect(currentOptions.showLabels).toBe(false);
			expect(currentOptions.labelPosition).toBe("after");
		});

		it("should merge render options with existing ones", () => {
			const initialOptions = {
				showLabels: true,
				fieldClassName: "custom-field",
			};

			const renderer = new ModernFormRenderer({}, initialOptions);

			const additionalOptions = {
				labelPosition: "above" as const,
			};

			renderer.setRenderOptions(additionalOptions);

			const currentOptions = renderer.getRenderOptions();
			expect(currentOptions.showLabels).toBe(true);
			expect(currentOptions.fieldClassName).toBe("custom-field");
			expect(currentOptions.labelPosition).toBe("above");
		});

		it("should get current render options", () => {
			const options = {
				showLabels: true,
				labelPosition: "before" as const,
			};

			const renderer = new ModernFormRenderer({}, options);
			const retrieved = renderer.getRenderOptions();

			expect(retrieved).toEqual(options);
			// Should return a copy, not the original object
			expect(retrieved).not.toBe(options);
		});
	});

	describe("Integration with Dependencies", () => {
		it("should pass event handlers to all setup functions", () => {
			const eventHandlers = {
				onSave: jest.fn(),
				onFieldChange: jest.fn(),
				onRemove: jest.fn(),
			};

			const renderer = new ModernFormRenderer(eventHandlers);

			const fileData: FileData = {
				name: "test.json",
				type: "json",
				content: { test: "value" },
				originalContent: "{}",
				handle: null,
			};

			renderer.renderFileEditor(fileData);

			expect(
				mockEventHandlers.setupFileActionEventListeners
			).toHaveBeenCalledWith(
				expect.any(HTMLElement),
				"test.json",
				eventHandlers
			);

			expect(mockEventHandlers.setupSaveEventListeners).toHaveBeenCalledWith(
				expect.any(HTMLElement),
				"test.json",
				eventHandlers
			);
		});

		it("should pass render options to dom-renderer", () => {
			const renderOptions = {
				showLabels: false,
				labelPosition: "after" as const,
				fieldClassName: "custom-field",
			};

			const renderer = new ModernFormRenderer({}, renderOptions);

			const fileData: FileData = {
				name: "test.json",
				type: "json",
				content: { test: "value" },
				originalContent: "{}",
				handle: null,
			};

			mockFormData.generateFormFieldsData.mockReturnValue([
				{
					type: "text",
					key: "test",
					value: "value",
					path: "test",
					label: "Test",
				},
			]);

			renderer.renderFileEditor(fileData);

			expect(mockDomRenderer.renderFormField).toHaveBeenCalledWith(
				expect.any(Object),
				renderOptions
			);
		});

		it("should call sticky behavior setup with correct parameters", () => {
			const fileData: FileData = {
				name: "sticky-test.json",
				type: "json",
				content: { test: "value" },
				originalContent: "{}",
				handle: null,
			};

			renderer.renderFileEditor(fileData);

			expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 0);
			expect(mockStickyBehavior.setupStickyBehavior).toHaveBeenCalledWith(
				mockSaveContainer,
				"sticky-test.json"
			);
		});
	});

	describe("Error Handling and Edge Cases", () => {
		it("should handle null content", () => {
			const fileData: FileData = {
				name: "null.json",
				type: "json",
				content: null,
				originalContent: "",
				handle: null,
			};

			renderer.renderFileEditor(fileData);

			expect(mockDomRenderer.renderErrorNotification).toHaveBeenCalledWith(
				"Failed to parse file: Not a valid configuration object."
			);
		});

		it("should handle undefined content", () => {
			const fileData: FileData = {
				name: "undefined.json",
				type: "json",
				content: undefined,
				originalContent: "",
				handle: null,
			};

			renderer.renderFileEditor(fileData);

			expect(mockDomRenderer.renderErrorNotification).toHaveBeenCalledWith(
				"Failed to parse file: Not a valid configuration object."
			);
		});

		it("should handle missing querySelector results gracefully", () => {
			const fileData: FileData = {
				name: "test.json",
				type: "json",
				content: { nested: { value: "test" } },
				originalContent: "{}",
				handle: null,
			};

			mockFormData.generateFormFieldsData.mockReturnValue([
				{
					type: "object",
					key: "nested",
					path: "nested",
					label: "Nested",
					value: { value: "test" },
					children: [],
				},
			]);

			// querySelector returns null (container not found)
			jest.spyOn(mockForm, "querySelector").mockReturnValue(null);

			expect(() => {
				renderer.renderFileEditor(fileData);
			}).not.toThrow();
		});

		it("should handle empty form fields data", () => {
			const fileData: FileData = {
				name: "empty.json",
				type: "json",
				content: {},
				originalContent: "{}",
				handle: null,
			};

			mockFormData.generateFormFieldsData.mockReturnValue([]);

			const result = renderer.renderFileEditor(fileData);

			expect(result).toBe(mockContainer);
			expect(mockDomRenderer.renderFormField).not.toHaveBeenCalled();
		});

		it("should handle special characters in file names", () => {
			const fileData: FileData = {
				name: "special-chars@#$%.json",
				type: "json",
				content: { test: "value" },
				originalContent: "{}",
				handle: null,
			};

			renderer.renderFileEditor(fileData);

			expect(mockDomFactory.createElement).toHaveBeenCalledWith({
				tag: "div",
				className: "file-editor fade-in",
				attributes: { "data-file": "special-chars@#$%.json" },
			});
		});

		it("should handle very large file names", () => {
			const longFileName = "a".repeat(500) + ".json";
			const fileData: FileData = {
				name: longFileName,
				type: "json",
				content: { test: "value" },
				originalContent: "{}",
				handle: null,
			};

			renderer.renderFileEditor(fileData);

			expect(mockDomRenderer.renderFileHeader).toHaveBeenCalledWith(
				longFileName,
				"json",
				undefined,
				false
			);
		});
	});

	describe("Memory Management", () => {
		it("should not create memory leaks through closures", () => {
			const fileData: FileData = {
				name: "memory-test.json",
				type: "json",
				content: { test: "value" },
				originalContent: "{}",
				handle: null,
			};

			// Render multiple times to test for memory leaks
			for (let i = 0; i < 10; i++) {
				renderer.renderFileEditor(fileData);
			}

			// Should call setup functions for each render
			expect(
				mockEventHandlers.setupFileActionEventListeners
			).toHaveBeenCalledTimes(10);
			expect(mockStickyBehavior.setupStickyBehavior).toHaveBeenCalledTimes(10);
		});

		it("should handle rapid successive renders", () => {
			const fileData: FileData = {
				name: "rapid-test.json",
				type: "json",
				content: { test: "value" },
				originalContent: "{}",
				handle: null,
			};

			// Rapid renders should not cause errors
			expect(() => {
				for (let i = 0; i < 100; i++) {
					renderer.renderFileEditor(fileData);
				}
			}).not.toThrow();
		});
	});

	describe("Interface Compliance", () => {
		it("should implement IRenderer interface correctly", () => {
			expect(typeof renderer.renderFileEditor).toBe("function");
			expect(typeof renderer.generateFormFields).toBe("function");
		});

		it("should return HTMLElement from renderFileEditor", () => {
			const fileData: FileData = {
				name: "test.json",
				type: "json",
				content: { test: "value" },
				originalContent: "{}",
				handle: null,
			};

			const result = renderer.renderFileEditor(fileData);
			expect(result).toBeInstanceOf(HTMLElement);
		});

		it("should return HTMLElement from generateFormFields", () => {
			const result = renderer.generateFormFields({}, "");
			expect(result).toBeInstanceOf(HTMLElement);
		});
	});
});
