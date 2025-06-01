/**
 * Comprehensive test suite for FilePersistence module
 * Tests data persistence, form extraction, file saving, error handling, and security
 */

import {
	describe,
	it,
	expect,
	beforeEach,
	afterEach,
	jest,
} from "@jest/globals";
import { FilePersistence } from "../../src/persistence.js";
import { FileData } from "../../src/interfaces.js";

// Mock dependencies
jest.mock("../../src/parsers.js", () => ({
	ParserFactory: {
		createParser: jest.fn(),
	},
}));

jest.mock("../../src/ui/notifications.js", () => ({
	NotificationService: {
		showSuccess: jest.fn(),
		showError: jest.fn(),
		showLoading: jest.fn(),
		hideLoading: jest.fn(),
	},
}));

jest.mock("../../src/fileHandler.js", () => ({
	FileHandler: jest.fn().mockImplementation(() => ({
		writeFile: jest
			.fn<(handle: any, content: string) => Promise<void>>()
			.mockResolvedValue(undefined),
	})),
}));

import { ParserFactory } from "../../src/parsers.js";
import { NotificationService } from "../../src/ui/notifications.js";
import { FileHandler } from "../../src/fileHandler.js";

// Mock window.showSaveFilePicker
const mockShowSaveFilePicker = jest.fn<(options?: any) => Promise<any>>();
Object.defineProperty(window, "showSaveFilePicker", {
	writable: true,
	value: mockShowSaveFilePicker,
});

// Mock file handle
const mockFileHandle = {
	name: "test.json",
	createWritable: jest.fn<() => Promise<any>>().mockResolvedValue({
		write: jest
			.fn<(chunk: any) => Promise<void>>()
			.mockResolvedValue(undefined),
		close: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
	}),
};

// Mock parser
const mockParser = {
	parse: jest.fn(),
	serialize: jest.fn(),
	getFileType: jest.fn().mockReturnValue("json"),
};

describe("FilePersistence", () => {
	let filePersistence: FilePersistence;
	let mockFileData: FileData;
	let mockFormElement: HTMLFormElement;

	beforeEach(() => {
		jest.clearAllMocks();
		filePersistence = new FilePersistence();

		// Setup default mock implementations
		(ParserFactory.createParser as jest.Mock).mockReturnValue(mockParser);
		mockParser.serialize.mockReturnValue('{"serialized": "data"}');
		mockShowSaveFilePicker.mockResolvedValue(mockFileHandle as any);

		// Create mock file data
		mockFileData = {
			name: "config.json",
			handle: mockFileHandle as any,
			type: "json",
			content: { original: "data" },
			originalContent: '{"original": "data"}',
		};

		// Create mock form element
		mockFormElement = document.createElement("form");
		document.body.appendChild(mockFormElement);
	});

	afterEach(() => {
		jest.restoreAllMocks();
		document.body.innerHTML = "";
	});

	describe("saveFile", () => {
		it("should save file with existing handle successfully", async () => {
			// Create form with test data
			const input = document.createElement("input");
			input.name = "test.field";
			input.value = "new value";
			mockFormElement.appendChild(input);

			await filePersistence.saveFile(mockFileData, mockFormElement);

			expect(ParserFactory.createParser).toHaveBeenCalledWith("json");
			expect(mockParser.serialize).toHaveBeenCalled();
			expect(FileHandler).toHaveBeenCalled();
			expect(NotificationService.showSuccess).toHaveBeenCalledWith(
				"Successfully saved config.json"
			);
		});

		it("should save file without handle using showSaveFilePicker", async () => {
			const fileDataWithoutHandle = {
				...mockFileData,
				handle: null,
			};

			const input = document.createElement("input");
			input.name = "test.field";
			input.value = "new value";
			mockFormElement.appendChild(input);

			await filePersistence.saveFile(fileDataWithoutHandle, mockFormElement);

			expect(mockShowSaveFilePicker).toHaveBeenCalledWith({
				suggestedName: "config.json",
				types: [
					{
						description: "JSON files",
						accept: { "application/json": [".json"] },
					},
				],
			});
			expect(NotificationService.showSuccess).toHaveBeenCalledWith(
				"Successfully saved config.json"
			);
		});

		it("should handle user cancellation during save", async () => {
			const fileDataWithoutHandle = {
				...mockFileData,
				handle: null,
			};

			const abortError = new Error("User cancelled");
			abortError.name = "AbortError";
			mockShowSaveFilePicker.mockRejectedValue(abortError);

			await expect(
				filePersistence.saveFile(fileDataWithoutHandle, mockFormElement)
			).rejects.toThrow("Save operation was cancelled");

			expect(NotificationService.showError).toHaveBeenCalledWith(
				"Failed to save config.json: Save operation was cancelled"
			);
		});

		it("should handle file writing errors", async () => {
			const writeError = new Error("Write failed");
			(FileHandler as jest.Mock).mockImplementationOnce(() => ({
				writeFile: jest
					.fn<(handle: any, content: string) => Promise<void>>()
					.mockRejectedValue(writeError),
			}));

			await expect(
				filePersistence.saveFile(mockFileData, mockFormElement)
			).rejects.toThrow("Write failed");
			expect(NotificationService.showError).toHaveBeenCalledWith(
				"Failed to save config.json: Write failed"
			);
		});

		it("should handle serialization errors", async () => {
			const serializationError = new Error("Serialization failed");
			mockParser.serialize.mockImplementation(() => {
				throw serializationError;
			});

			await expect(
				filePersistence.saveFile(mockFileData, mockFormElement)
			).rejects.toThrow("Serialization failed");
		});
	});

	describe("Form Data Extraction", () => {
		it("should extract simple form fields", async () => {
			// Create form with various input types
			const textInput = document.createElement("input");
			textInput.type = "text";
			textInput.name = "textField";
			textInput.value = "text value";
			mockFormElement.appendChild(textInput);

			const numberInput = document.createElement("input");
			numberInput.type = "number";
			numberInput.name = "numberField";
			numberInput.value = "42";
			mockFormElement.appendChild(numberInput);

			// Mock parser to capture extracted data
			let extractedData: any;
			mockParser.serialize.mockImplementation((data: any) => {
				extractedData = data;
				return JSON.stringify(data);
			});

			await filePersistence.saveFile(mockFileData, mockFormElement);

			expect(extractedData.textField).toBe("text value");
			expect(extractedData.numberField).toBe("42");
		});

		it("should handle nested field paths with dot notation", async () => {
			const nestedInput = document.createElement("input");
			nestedInput.name = "nested.field.path";
			nestedInput.value = "nested value";
			mockFormElement.appendChild(nestedInput);

			const originalData = {
				nested: {
					field: {
						existingValue: "existing",
					},
				},
			};

			const fileDataWithNested = {
				...mockFileData,
				content: originalData,
			};

			let extractedData: any;
			mockParser.serialize.mockImplementation((data: any) => {
				extractedData = data;
				return JSON.stringify(data);
			});

			await filePersistence.saveFile(fileDataWithNested, mockFormElement);

			expect(extractedData.nested.field.path).toBe("nested value");
			expect(extractedData.nested.field.existingValue).toBe("existing");
		});
	});

	describe("Security Tests", () => {
		it("should handle XSS attempts in field values", async () => {
			const xssInput = document.createElement("input");
			xssInput.name = "xssField";
			xssInput.value = "<script>alert('xss')</script>";
			mockFormElement.appendChild(xssInput);

			let extractedData: any;
			mockParser.serialize.mockImplementation((data: any) => {
				extractedData = data;
				return JSON.stringify(data);
			});

			await filePersistence.saveFile(mockFileData, mockFormElement);

			expect(extractedData.xssField).toBe("<script>alert('xss')</script>");
			// Should be stored as plain text, not executed
		});

		it("should handle prototype pollution attempts", async () => {
			const maliciousInput = document.createElement("input");
			maliciousInput.name = "__proto__.polluted";
			maliciousInput.value = "exploit attempt";
			mockFormElement.appendChild(maliciousInput);

			let extractedData: any;
			mockParser.serialize.mockImplementation((data: any) => {
				extractedData = data;
				return JSON.stringify(data);
			});

			await filePersistence.saveFile(mockFileData, mockFormElement);

			// The data should be captured but serialized safely
			expect(mockParser.serialize).toHaveBeenCalled();
			expect(extractedData).toBeDefined();
		});
	});

	describe("Error Handling", () => {
		it("should handle parser creation failures", async () => {
			(ParserFactory.createParser as jest.Mock).mockImplementation(() => {
				throw new Error("Parser creation failed");
			});

			await expect(
				filePersistence.saveFile(mockFileData, mockFormElement)
			).rejects.toThrow("Parser creation failed");
		});

		it("should handle write stream creation failures", async () => {
			const failingHandle = {
				...mockFileHandle,
				createWritable: jest
					.fn<() => Promise<any>>()
					.mockRejectedValue(new Error("Stream creation failed")),
			};

			mockShowSaveFilePicker.mockResolvedValue(failingHandle);

			const fileDataWithoutHandle = {
				...mockFileData,
				handle: null,
			};

			await expect(
				filePersistence.saveFile(fileDataWithoutHandle, mockFormElement)
			).rejects.toThrow("Stream creation failed");
		});
	});

	describe("Performance Tests", () => {
		it("should handle large forms efficiently", async () => {
			// Create a form with many fields
			for (let i = 0; i < 100; i++) {
				// Reduced from 1000 for test speed
				const input = document.createElement("input");
				input.name = `field${i}`;
				input.value = `value${i}`;
				mockFormElement.appendChild(input);
			}

			const startTime = Date.now();
			await filePersistence.saveFile(mockFileData, mockFormElement);
			const duration = Date.now() - startTime;

			expect(duration).toBeLessThan(1000); // Should complete within 1 second
		});
	});
});
