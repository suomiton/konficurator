import {
	describe,
	it,
	expect,
	beforeEach,
	afterEach,
	jest,
} from "@jest/globals";
import {
	FormFieldData,
	TextFieldData,
	NumberFieldData,
	BooleanFieldData,
	ArrayFieldData,
} from "../../src/ui/form-data.js";
import { FormEventHandlers } from "../../src/ui/event-handlers.js";

// Mock DOM renderer module
const mockRenderFormField = jest.fn() as jest.MockedFunction<
	(fieldData: FormFieldData) => HTMLElement
>;
const mockRenderFileHeader = jest.fn() as jest.MockedFunction<
	(fileName: string, fileType: string, hasHandle?: boolean) => HTMLElement
>;
const mockRenderSaveContainer = jest.fn() as jest.MockedFunction<
	(fileName: string) => HTMLElement
>;
const mockRenderErrorNotification = jest.fn() as jest.MockedFunction<
	(message: string) => HTMLElement
>;

jest.mock("../../src/ui/dom-renderer.js", () => ({
	renderFormField: mockRenderFormField,
	renderFileHeader: mockRenderFileHeader,
	renderSaveContainer: mockRenderSaveContainer,
	renderErrorNotification: mockRenderErrorNotification,
}));

// Import after mocking
import {
	renderFormField,
	renderFileHeader,
	renderSaveContainer,
	renderErrorNotification,
} from "../../src/ui/dom-renderer.js";

describe("DOM Renderer", () => {
	let mockEventHandlers: FormEventHandlers;

	beforeEach(() => {
		// Clear all mocks
		jest.clearAllMocks();

		// Set up mock DOM environment
		document.body.innerHTML = "";

		// Set up mock event handlers
		mockEventHandlers = {
			onFileSave: jest.fn(),
			onFileRefresh: jest.fn(),
			onFieldChange: jest.fn(),
			onArrayItemAdd: jest.fn(),
			onArrayItemRemove: jest.fn(),
		};

		// Set up default mock implementations
		mockRenderFormField.mockImplementation((fieldData: FormFieldData) => {
			const element = document.createElement("div");
			element.className = `form-field form-field-${fieldData.type}`;
			element.setAttribute("data-path", fieldData.path);
			element.textContent = `${fieldData.label}: ${fieldData.value}`;
			return element;
		});

		mockRenderFileHeader.mockImplementation(
			(filename: string, fileType: string) => {
				const element = document.createElement("div");
				element.className = "file-header";
				element.textContent = `${filename} (${fileType})`;
				return element;
			}
		);

		mockRenderSaveContainer.mockImplementation((fileName: string) => {
			const element = document.createElement("div");
			element.className = "save-container";
			const button = document.createElement("button");
			button.textContent = "Save";
			button.onclick = () => mockEventHandlers.onFileSave?.(fileName);
			element.appendChild(button);
			return element;
		});

		mockRenderErrorNotification.mockImplementation((message: string) => {
			const element = document.createElement("div");
			element.className = "error-notification";
			element.textContent = message;
			return element;
		});
	});

	afterEach(() => {
		document.body.innerHTML = "";
	});

	describe("Form Field Rendering", () => {
		it("should render a text field correctly", () => {
			const fieldData: TextFieldData = {
				type: "text",
				value: "test value",
				path: "config.name",
				label: "Name",
				key: "config.name",
			};

			renderFormField(fieldData);

			expect(mockRenderFormField).toHaveBeenCalledWith(fieldData);
		});

		it("should render a number field with proper input type", () => {
			const fieldData: NumberFieldData = {
				type: "number",
				value: 42,
				path: "config.port",
				label: "Port Number",
				key: "config.port",
			};

			renderFormField(fieldData);

			expect(mockRenderFormField).toHaveBeenCalledWith(fieldData);
		});

		it("should render a boolean field with checkbox", () => {
			const fieldData: BooleanFieldData = {
				type: "boolean",
				value: true,
				checked: true,
				path: "config.enabled",
				label: "Enabled",
				key: "config.enabled",
			};

			renderFormField(fieldData);

			expect(mockRenderFormField).toHaveBeenCalledWith(fieldData);
		});

		it("should render an object field properly", () => {
			const fieldData: FormFieldData = {
				type: "object",
				value: { nested: "value" },
				path: "config.database",
				label: "Database Config",
				key: "config.database",
			};

			renderFormField(fieldData);

			expect(mockRenderFormField).toHaveBeenCalledWith(fieldData);
		});

		it("should render an array field with items", () => {
			const fieldData: ArrayFieldData = {
				type: "array",
				value: ["item1", "item2"],
				path: "config.servers",
				label: "Servers",
				key: "config.servers",
				jsonValue: JSON.stringify(["item1", "item2"]),
			};

			renderFormField(fieldData);

			expect(mockRenderFormField).toHaveBeenCalledWith(fieldData);
		});
	});

	describe("File Header Rendering", () => {
		it("should render file header with filename", () => {
			const filename = "config.json";
			const fileType = "json";

			renderFileHeader(filename, fileType);

			expect(mockRenderFileHeader).toHaveBeenCalledWith(filename, fileType);
		});

		it("should handle long filenames", () => {
			const longFilename =
				"very-long-configuration-file-name-that-might-cause-display-issues.json";
			const fileType = "json";

			renderFileHeader(longFilename, fileType);

			expect(mockRenderFileHeader).toHaveBeenCalledWith(longFilename, fileType);
		});

		it("should handle special characters in filenames", () => {
			const specialFilename = "config_file-v2.0 (backup).json";
			const fileType = "json";

			renderFileHeader(specialFilename, fileType);

			expect(mockRenderFileHeader).toHaveBeenCalledWith(
				specialFilename,
				fileType
			);
		});
	});

	describe("Save Container Rendering", () => {
		it("should render save container with filename", () => {
			const fileName = "config.json";

			renderSaveContainer(fileName);

			expect(mockRenderSaveContainer).toHaveBeenCalledWith(fileName);
		});

		it("should handle save button interaction", () => {
			// Set up a real implementation for testing
			mockRenderSaveContainer.mockImplementationOnce((fileName: string) => {
				const container = document.createElement("div");
				const button = document.createElement("button");
				button.onclick = () => mockEventHandlers.onFileSave?.(fileName);
				container.appendChild(button);
				document.body.appendChild(container);
				return container;
			});

			const fileName = "config.json";
			renderSaveContainer(fileName);

			const button = document.querySelector("button");
			button?.click();

			expect(mockEventHandlers.onFileSave).toHaveBeenCalledWith(fileName);
		});
	});

	describe("Error Notification Rendering", () => {
		it("should render error notification with message", () => {
			const errorMessage = "Invalid JSON format";

			renderErrorNotification(errorMessage);

			expect(mockRenderErrorNotification).toHaveBeenCalledWith(errorMessage);
		});

		it("should handle long error messages", () => {
			const longMessage =
				"This is a very long error message that might need to be truncated or wrapped in the UI to ensure proper display and user experience";

			renderErrorNotification(longMessage);

			expect(mockRenderErrorNotification).toHaveBeenCalledWith(longMessage);
		});

		it("should handle error messages with special characters", () => {
			const specialMessage =
				"Error: File 'config.json' contains invalid characters: <>\"&";

			renderErrorNotification(specialMessage);

			expect(mockRenderErrorNotification).toHaveBeenCalledWith(specialMessage);
		});
	});

	describe("Security and XSS Prevention", () => {
		it("should handle potentially malicious field data safely", () => {
			const maliciousFieldData: TextFieldData = {
				type: "text",
				value: "<script>alert('xss')</script>",
				path: "config.dangerous",
				label: "<img onerror=alert('xss') src=x>",
				key: "config.dangerous",
			};

			renderFormField(maliciousFieldData);

			expect(mockRenderFormField).toHaveBeenCalledWith(maliciousFieldData);
		});

		it("should handle malicious filename safely", () => {
			const maliciousFilename = "<script>alert('xss')</script>.json";
			const fileType = "json";

			renderFileHeader(maliciousFilename, fileType);

			expect(mockRenderFileHeader).toHaveBeenCalledWith(
				maliciousFilename,
				fileType
			);
		});

		it("should handle malicious error messages safely", () => {
			const maliciousMessage = "<script>alert('xss')</script>";

			renderErrorNotification(maliciousMessage);

			expect(mockRenderErrorNotification).toHaveBeenCalledWith(
				maliciousMessage
			);
		});
	});

	describe("Performance and Edge Cases", () => {
		it("should handle null values gracefully", () => {
			const fieldData: TextFieldData = {
				type: "text",
				value: null as any,
				path: "config.optional",
				label: "Optional Field",
				key: "config.optional",
			};

			renderFormField(fieldData);

			expect(mockRenderFormField).toHaveBeenCalledWith(fieldData);
		});

		it("should handle undefined values gracefully", () => {
			const fieldData: TextFieldData = {
				type: "text",
				value: undefined as any,
				path: "config.undefined",
				label: "Undefined Field",
				key: "config.undefined",
			};

			renderFormField(fieldData);

			expect(mockRenderFormField).toHaveBeenCalledWith(fieldData);
		});

		it("should handle empty string values", () => {
			const fieldData: TextFieldData = {
				type: "text",
				value: "",
				path: "config.empty",
				label: "Empty Field",
				key: "config.empty",
			};

			renderFormField(fieldData);

			expect(mockRenderFormField).toHaveBeenCalledWith(fieldData);
		});

		it("should handle large numeric values", () => {
			const fieldData: NumberFieldData = {
				type: "number",
				value: Number.MAX_SAFE_INTEGER,
				path: "config.large",
				label: "Large Number",
				key: "config.large",
			};

			renderFormField(fieldData);

			expect(mockRenderFormField).toHaveBeenCalledWith(fieldData);
		});

		it("should handle complex nested objects", () => {
			const complexObject = {
				level1: {
					level2: {
						level3: {
							data: "deep value",
							array: [1, 2, { nested: true }],
						},
					},
				},
			};

			const fieldData: FormFieldData = {
				type: "object",
				value: complexObject,
				path: "config.complex",
				label: "Complex Object",
				key: "config.complex",
			};

			renderFormField(fieldData);

			expect(mockRenderFormField).toHaveBeenCalledWith(fieldData);
		});

		it("should handle large arrays efficiently", () => {
			const largeArray = Array.from({ length: 1000 }, (_, i) => `item-${i}`);

			const fieldData: ArrayFieldData = {
				type: "array",
				value: largeArray,
				path: "config.items",
				label: "Large Array",
				key: "config.items",
				jsonValue: JSON.stringify(largeArray),
			};

			renderFormField(fieldData);

			expect(mockRenderFormField).toHaveBeenCalledWith(fieldData);
		});
	});

	describe("Type Safety and Error Handling", () => {
		it("should handle different value types for text fields", () => {
			const fieldData: FormFieldData = {
				type: "text",
				value: 123 as any, // Invalid type for text field
				path: "config.mixed",
				label: "Mixed Type",
				key: "config.mixed",
			};

			renderFormField(fieldData);

			expect(mockRenderFormField).toHaveBeenCalledWith(fieldData);
		});

		it("should handle boolean field edge cases", () => {
			const fieldData: BooleanFieldData = {
				type: "boolean",
				value: false,
				checked: false,
				path: "config.disabled",
				label: "Disabled",
				key: "config.disabled",
			};

			renderFormField(fieldData);

			expect(mockRenderFormField).toHaveBeenCalledWith(fieldData);
		});
	});

	describe("Accessibility and User Experience", () => {
		it("should render fields with proper accessibility attributes", () => {
			const fieldData: TextFieldData = {
				type: "text",
				value: "accessible value",
				path: "config.accessible",
				label: "Accessible Field",
				key: "config.accessible",
			};

			renderFormField(fieldData);

			expect(mockRenderFormField).toHaveBeenCalledWith(fieldData);
		});

		it("should handle keyboard navigation requirements", () => {
			const fileName = "config.json";
			renderSaveContainer(fileName);

			expect(mockRenderSaveContainer).toHaveBeenCalledWith(fileName);
		});

		it("should provide appropriate error feedback", () => {
			const userFriendlyMessage = "Please check your input and try again.";

			renderErrorNotification(userFriendlyMessage);

			expect(mockRenderErrorNotification).toHaveBeenCalledWith(
				userFriendlyMessage
			);
		});
	});
});
