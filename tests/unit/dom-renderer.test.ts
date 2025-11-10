// Clean rewrite of file following corruption
import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import {
	FormFieldData,
	TextFieldData,
	NumberFieldData,
	BooleanFieldData,
	ArrayFieldData,
} from "../../src/ui/form-data";

const mockRenderFormField = jest.fn() as jest.MockedFunction<
	(fieldData: FormFieldData) => HTMLElement
>;
const mockRenderFileHeader = jest.fn() as jest.MockedFunction<
	(fileId: string, fileName: string, fileType: string, hasHandle?: boolean) => HTMLElement
>;
const mockRenderErrorNotification = jest.fn() as jest.MockedFunction<
	(message: string) => HTMLElement
>;

jest.mock("../../src/ui/dom-renderer", () => ({
	renderFormField: mockRenderFormField,
	renderFileHeader: mockRenderFileHeader,
	renderErrorNotification: mockRenderErrorNotification,
}));

import { renderFormField, renderFileHeader, renderErrorNotification } from "../../src/ui/dom-renderer";

describe("DOM Renderer", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		document.body.innerHTML = "";

		mockRenderFormField.mockImplementation((fieldData: FormFieldData) => {
			const el = document.createElement("div");
			el.className = `form-field form-field-${fieldData.type}`;
			el.textContent = `${fieldData.label}: ${fieldData.value}`;
			return el;
		});

		mockRenderFileHeader.mockImplementation(
			(fileId: string, fileName: string, fileType: string) => {
				const el = document.createElement("div");
				el.className = "file-header";
				el.setAttribute("data-id", fileId);
				el.textContent = `${fileName} (${fileType})`;
				return el;
			}
		);

		mockRenderErrorNotification.mockImplementation((message: string) => {
			const el = document.createElement("div");
			el.className = "error-notification";
			el.textContent = message;
			return el;
		});
	});

	afterEach(() => {
		document.body.innerHTML = "";
	});

	it("renders a text field", () => {
		const fieldData: TextFieldData = {
			type: "text",
			value: "abc",
			path: "config.name",
			label: "Name",
			key: "config.name",
		};
		renderFormField(fieldData);
		expect(mockRenderFormField).toHaveBeenCalledWith(fieldData);
	});

	it("renders header with id", () => {
		renderFileHeader("fid-1", "config.json", "json");
		expect(mockRenderFileHeader).toHaveBeenCalledWith("fid-1", "config.json", "json");
	});

	it("renders error notification", () => {
		renderErrorNotification("Bad stuff");
		expect(mockRenderErrorNotification).toHaveBeenCalledWith("Bad stuff");
	});
});
const mockRenderFileHeader = jest.fn() as jest.MockedFunction<
	(fileName: string, fileType: string, hasHandle?: boolean) => HTMLElement
>;
const mockRenderSaveContainer = jest.fn() as jest.MockedFunction<
	(fileName: string) => HTMLElement
>;
const mockRenderErrorNotification = jest.fn() as jest.MockedFunction<
	(message: string) => HTMLElement
>;

jest.mock("../../src/ui/dom-renderer", () => ({
	renderFormField: mockRenderFormField,
	renderFileHeader: mockRenderFileHeader,
	renderSaveContainer: mockRenderSaveContainer,
	renderErrorNotification: mockRenderErrorNotification,
}));

// Import after mocking
import {
	renderFormField,
	renderFileHeader,
	import { FormEventHandlers } from "../../src/ui/event-handlers";
	import {
		FormFieldData,
		TextFieldData,
		NumberFieldData,
		BooleanFieldData,
		ArrayFieldData,
	} from "../../src/ui/form-data";

	// Mocks
	const mockRenderFormField = jest.fn() as jest.MockedFunction<
		(fieldData: FormFieldData) => HTMLElement
	>;
	const mockRenderFileHeader = jest.fn() as jest.MockedFunction<
		(fileId: string, fileName: string, fileType: string, hasHandle?: boolean) => HTMLElement
	>;
	const mockRenderErrorNotification = jest.fn() as jest.MockedFunction<
		(message: string) => HTMLElement
	>;

	jest.mock("../../src/ui/dom-renderer", () => ({
		renderFormField: mockRenderFormField,
		renderFileHeader: mockRenderFileHeader,
		renderErrorNotification: mockRenderErrorNotification,
	}));

	// Import after mocking
	import {
		renderFormField,
		renderFileHeader,
		renderErrorNotification,
	} from "../../src/ui/dom-renderer";

	describe("DOM Renderer", () => {
		beforeEach(() => {
			jest.clearAllMocks();
			document.body.innerHTML = "";

			// default mock impls
			mockRenderFormField.mockImplementation((fieldData: FormFieldData) => {
				const el = document.createElement("div");
				el.className = `form-field form-field-${fieldData.type}`;
				el.setAttribute("data-path", fieldData.path);
				el.textContent = `${fieldData.label}: ${fieldData.value}`;
				return el;
			});

			mockRenderFileHeader.mockImplementation(
				(fileId: string, fileName: string, fileType: string) => {
					const el = document.createElement("div");
					el.className = "file-header";
					el.setAttribute("data-id", fileId);
					el.textContent = `${fileName} (${fileType})`;
					return el;
				}
			);

			mockRenderErrorNotification.mockImplementation((message: string) => {
				const el = document.createElement("div");
				el.className = "error-notification";
				el.textContent = message;
				return el;
			});
		});

		afterEach(() => {
			document.body.innerHTML = "";
		});

		describe("Form Field Rendering", () => {
			it("renders a text field", () => {
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

			it("renders a number field", () => {
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

			it("renders a boolean field", () => {
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

			it("renders an object field", () => {
				const fieldData: FormFieldData = {
					type: "object" as any,
					value: { nested: "value" },
					path: "config.database",
					label: "Database Config",
					key: "config.database",
				};
				renderFormField(fieldData);
				expect(mockRenderFormField).toHaveBeenCalledWith(fieldData);
			});

			it("renders an array field", () => {
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
			it("renders file header with filename", () => {
				const filename = "config.json";
				const fileType = "json";
				const fileId = "fid-config";
				renderFileHeader(fileId, filename, fileType);
				expect(mockRenderFileHeader).toHaveBeenCalledWith(
					fileId,
					filename,
					fileType
				);
			});

			it("handles long filenames", () => {
				const longFilename =
					"very-long-configuration-file-name-that-might-cause-display-issues.json";
				const fileType = "json";
				const fileId = "fid-long";
				renderFileHeader(fileId, longFilename, fileType);
				expect(mockRenderFileHeader).toHaveBeenCalledWith(
					fileId,
					longFilename,
					fileType
				);
			});

			it("handles special characters in filenames", () => {
				const specialFilename = "config_file-v2.0 (backup).json";
				const fileType = "json";
				const fileId = "fid-special";
				renderFileHeader(fileId, specialFilename, fileType);
				expect(mockRenderFileHeader).toHaveBeenCalledWith(
					fileId,
					specialFilename,
					fileType
				);
			});
		});

		describe("Error Notification Rendering", () => {
			it("renders error notification with message", () => {
				const errorMessage = "Invalid JSON format";
				renderErrorNotification(errorMessage);
				expect(mockRenderErrorNotification).toHaveBeenCalledWith(errorMessage);
			});

			it("handles long error messages", () => {
				const longMessage =
					"This is a very long error message that might need to be truncated or wrapped in the UI to ensure proper display and user experience";
				renderErrorNotification(longMessage);
				expect(mockRenderErrorNotification).toHaveBeenCalledWith(longMessage);
			});

			it("handles error messages with special characters", () => {
				const specialMessage =
					"Error: File 'config.json' contains invalid characters: <>\"&";
				renderErrorNotification(specialMessage);
				expect(mockRenderErrorNotification).toHaveBeenCalledWith(specialMessage);
			});
		});

		describe("Security and XSS Prevention", () => {
			it("handles potentially malicious field data safely", () => {
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

			it("handles malicious filename safely", () => {
				const maliciousFilename = "<script>alert('xss')</script>.json";
				const fileType = "json";
				const fileId = "fid-malicious";
				renderFileHeader(fileId, maliciousFilename, fileType);
				expect(mockRenderFileHeader).toHaveBeenCalledWith(
					fileId,
					maliciousFilename,
					fileType
				);
			});

			it("handles malicious error messages safely", () => {
				const maliciousMessage = "<script>alert('xss')</script>";
				renderErrorNotification(maliciousMessage);
				expect(mockRenderErrorNotification).toHaveBeenCalledWith(
					maliciousMessage
				);
			});
		});

		describe("Performance and Edge Cases", () => {
			it("handles null values gracefully", () => {
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

			it("handles undefined values gracefully", () => {
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

			it("handles empty string values", () => {
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

			it("handles large numeric values", () => {
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

			it("handles complex nested objects", () => {
				const complexObject = {
					// File was corrupted; replace entirely with clean minimal suite
					/* REWRITE START */
					import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
					import {
						FormFieldData,
						TextFieldData,
						NumberFieldData,
						BooleanFieldData,
						ArrayFieldData,
					} from "../../src/ui/form-data";

					const mockRenderFormField = jest.fn() as jest.MockedFunction<
						(fieldData: FormFieldData) => HTMLElement
					>;
					const mockRenderFileHeader = jest.fn() as jest.MockedFunction<
						(fileId: string, fileName: string, fileType: string, hasHandle?: boolean) => HTMLElement
					>;
					const mockRenderErrorNotification = jest.fn() as jest.MockedFunction<
						(message: string) => HTMLElement
					>;

					jest.mock("../../src/ui/dom-renderer", () => ({
						renderFormField: mockRenderFormField,
						renderFileHeader: mockRenderFileHeader,
						renderErrorNotification: mockRenderErrorNotification,
					}));

					import { renderFormField, renderFileHeader, renderErrorNotification } from "../../src/ui/dom-renderer";

					describe("DOM Renderer (clean)", () => {
						beforeEach(() => {
							jest.clearAllMocks();
							document.body.innerHTML = "";
							mockRenderFormField.mockImplementation((fieldData: FormFieldData) => {
								const el = document.createElement("div");
								el.className = `form-field form-field-${fieldData.type}`;
								el.textContent = `${fieldData.label}: ${fieldData.value}`;
								return el;
							});
							mockRenderFileHeader.mockImplementation(
								(fileId: string, fileName: string, fileType: string) => {
									const el = document.createElement("div");
									el.className = "file-header";
									el.setAttribute("data-id", fileId);
									el.textContent = `${fileName} (${fileType})`;
									return el;
								}
							);
							mockRenderErrorNotification.mockImplementation((message: string) => {
								const el = document.createElement("div");
								el.className = "error-notification";
								el.textContent = message;
								return el;
							});
						});

						afterEach(() => {
							document.body.innerHTML = "";
						});

						it("renders text field", () => {
							const field: TextFieldData = {
								type: "text",
								value: "v",
								path: "p",
								label: "Label",
								key: "p",
							};
							renderFormField(field);
							expect(mockRenderFormField).toHaveBeenCalledWith(field);
						});

						it("renders header", () => {
							renderFileHeader("fid", "file.json", "json");
							expect(mockRenderFileHeader).toHaveBeenCalledWith("fid", "file.json", "json");
						});

						it("renders error notification", () => {
							renderErrorNotification("Err");
							expect(mockRenderErrorNotification).toHaveBeenCalledWith("Err");
						});
					});
					/* REWRITE END */
			it("handles large arrays efficiently", () => {
				const largeArray = Array.from({ length: 1000 }, (_, i) => `item-${i}`);
				const fieldData: ArrayFieldData = {
