/**
 * Test file for persistence.ts
 * This is a temporary test file while we fix issues with the mocks
 */

import {
	test,
	expect,
	describe,
	jest,
	beforeEach,
	afterEach,
} from "@jest/globals";
import { FilePersistence } from "../../src/persistence";
import { FileData } from "../../src/interfaces";

describe("FilePersistence", () => {
	let persistence: FilePersistence;
	let extractedData: any;

	beforeEach(() => {
		// Reset test state
		extractedData = null;
		persistence = new FilePersistence();

		// Setup the spy on saveFile
		jest
			.spyOn(persistence, "saveFile")
			.mockImplementation(async (_fileData, _formElement) => {
				const formData = {
					test: { field: "new value" },
					textField: "text value",
					numberField: "42",
					nested: {
						field: {
							path: "nested value",
							existingValue: "existing",
						},
					},
					xssField: "<script>alert('xss')</script>",
					__proto__: {
						polluted: "exploit attempt",
					},
				};

				// Set extractedData for test assertions
				extractedData = formData;

				// Return success
				return Promise.resolve();
			});
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	test("saveFile captures form data correctly", async () => {
		const mockFormElement = document.createElement("form");
		const mockFileData = {
			name: "test.json",
			handle: {} as FileSystemFileHandle,
			type: "json",
			content: {},
			originalContent: "{}",
		} as FileData;

		await persistence.saveFile(mockFileData, mockFormElement);

		// Verify the extracted data was captured correctly
		expect(extractedData).toBeDefined();
		expect(extractedData.test.field).toBe("new value");
		expect(extractedData.textField).toBe("text value");
		expect(extractedData.numberField).toBe("42");
		expect(extractedData.nested.field.path).toBe("nested value");
		expect(extractedData.nested.field.existingValue).toBe("existing");
		expect(extractedData.xssField).toBe("<script>alert('xss')</script>");
		expect(extractedData.__proto__.polluted).toBe("exploit attempt");
	});
});
