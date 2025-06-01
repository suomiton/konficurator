/**
 * Comprehensive unit tests for file conflict detection feature
 * Tests FileHandler.isFileModifiedOnDisk(), ConfirmationDialog.showFileConflictDialog(),
 * and integration in the save process
 */

import {
	describe,
	it,
	expect,
	beforeEach,
	afterEach,
	jest,
} from "@jest/globals";

// Mock DOM factory functions - declare before jest.mock
const mockCreateElement = jest.fn();
const mockCreateButton = jest.fn();

jest.mock("../../src/ui/dom-factory", () => ({
	createElement: mockCreateElement,
	createButton: mockCreateButton,
}));

// Import after mocking
import { FileHandler } from "../../src/fileHandler.js";
import { ConfirmationDialog } from "../../src/confirmation.js";
import { FileData } from "../../src/interfaces.js";

describe("File Conflict Detection Feature", () => {
	let fileHandler: FileHandler;
	let mockFileHandle: any;
	let mockFile: any;

	beforeEach(() => {
		// Clear DOM
		document.body.innerHTML = "";

		// Initialize FileHandler
		fileHandler = new FileHandler();

		// Create mock file with mutable lastModified
		mockFile = {
			name: "test.json",
			size: 1024,
			type: "application/json",
			lastModified: Date.now(),
			text: jest
				.fn<() => Promise<string>>()
				.mockResolvedValue('{"test": "data"}'),
			arrayBuffer: jest.fn<() => Promise<ArrayBuffer>>(),
			stream: jest.fn<() => ReadableStream>(),
			slice:
				jest.fn<(start?: number, end?: number, contentType?: string) => Blob>(),
			webkitRelativePath: "",
		};

		// Create mock file handle
		mockFileHandle = {
			name: "test.json",
			kind: "file" as const,
			getFile: jest.fn<() => Promise<File>>().mockResolvedValue(mockFile),
			createWritable: jest.fn<() => Promise<FileSystemWritableFileStream>>(),
			queryPermission:
				jest.fn<(options?: { mode: string }) => Promise<string>>(),
			requestPermission:
				jest.fn<(options?: { mode: string }) => Promise<string>>(),
			isSameEntry: jest
				.fn<(other: FileSystemHandle) => Promise<boolean>>()
				.mockResolvedValue(false),
		};

		// Set up DOM factory mocks
		mockCreateElement.mockImplementation((config: any) => {
			const element = document.createElement(config.tag || "div");
			if (config.className) element.className = config.className;
			if (config.textContent) element.textContent = config.textContent;
			if (config.innerHTML) element.innerHTML = config.innerHTML;
			return element;
		});

		mockCreateButton.mockImplementation((config: any) => {
			const button = document.createElement("button");
			if (config.className) button.className = config.className;
			if (config.textContent) button.textContent = config.textContent;
			if (config.type) button.type = config.type;
			return button;
		});

		jest.clearAllMocks();
	});

	afterEach(() => {
		// Clean up DOM
		document.body.innerHTML = "";
		jest.clearAllMocks();
	});

	describe("FileHandler.isFileModifiedOnDisk()", () => {
		it("should return true when file on disk is newer", async () => {
			const originalTime = Date.now() - 10000; // 10 seconds ago
			const newTime = Date.now(); // Now

			const fileData: FileData = {
				name: "test.json",
				handle: mockFileHandle,
				type: "json",
				content: {},
				originalContent: "{}",
				lastModified: originalTime,
			};

			// Mock file on disk has newer timestamp
			mockFile.lastModified = newTime;

			const result = await fileHandler.isFileModifiedOnDisk(fileData);

			expect(result).toBe(true);
			expect(mockFileHandle.getFile).toHaveBeenCalledTimes(1);
		});

		it("should return false when file on disk is older or same", async () => {
			const currentTime = Date.now();

			const fileData: FileData = {
				name: "test.json",
				handle: mockFileHandle,
				type: "json",
				content: {},
				originalContent: "{}",
				lastModified: currentTime,
			};

			// Mock file on disk has same or older timestamp
			mockFile.lastModified = currentTime - 1000; // 1 second older

			const result = await fileHandler.isFileModifiedOnDisk(fileData);

			expect(result).toBe(false);
		});

		it("should return false when file has no handle", async () => {
			const fileData: FileData = {
				name: "test.json",
				handle: null,
				type: "json",
				content: {},
				originalContent: "{}",
				lastModified: Date.now(),
			};

			const result = await fileHandler.isFileModifiedOnDisk(fileData);

			expect(result).toBe(false);
		});

		it("should return false when file has no lastModified timestamp", async () => {
			const fileData: FileData = {
				name: "test.json",
				handle: mockFileHandle,
				type: "json",
				content: {},
				originalContent: "{}",
				// no lastModified property
			};

			const result = await fileHandler.isFileModifiedOnDisk(fileData);

			expect(result).toBe(false);
		});

		it("should return false when file access fails", async () => {
			const fileData: FileData = {
				name: "test.json",
				handle: mockFileHandle,
				type: "json",
				content: {},
				originalContent: "{}",
				lastModified: Date.now(),
			};

			// Mock file access failure
			mockFileHandle.getFile.mockRejectedValue(new Error("File not found"));

			// Spy on console.warn to verify error handling
			const consoleSpy = jest
				.spyOn(console, "warn")
				.mockImplementation(() => {});

			const result = await fileHandler.isFileModifiedOnDisk(fileData);

			expect(result).toBe(false);
			expect(consoleSpy).toHaveBeenCalledWith(
				"Cannot check modification status for test.json:",
				expect.any(Error)
			);

			consoleSpy.mockRestore();
		});

		it("should handle edge case when timestamps are exactly equal", async () => {
			const exactTime = Date.now();

			const fileData: FileData = {
				name: "test.json",
				handle: mockFileHandle,
				type: "json",
				content: {},
				originalContent: "{}",
				lastModified: exactTime,
			};

			mockFile.lastModified = exactTime;

			const result = await fileHandler.isFileModifiedOnDisk(fileData);

			expect(result).toBe(false); // Same timestamp means not modified
		});
	});

	describe("ConfirmationDialog.showFileConflictDialog()", () => {
		it("should create and display file conflict dialog with correct structure", async () => {
			const fileName = "test.json";

			// Start the dialog (don't await yet)
			const dialogPromise = ConfirmationDialog.showFileConflictDialog(fileName);

			// Allow DOM operations to complete
			await new Promise((resolve) => setTimeout(resolve, 0));

			// Check that dialog was created and added to DOM
			const overlay = document.querySelector(".confirmation-overlay");
			expect(overlay).not.toBeNull();

			const dialog = document.querySelector(".file-conflict-dialog");
			expect(dialog).not.toBeNull();

			// Check dialog content
			const title = dialog?.querySelector("h3");
			expect(title?.textContent).toBe("File Conflict Detected");

			const message = dialog?.querySelector("p");
			expect(message?.innerHTML).toContain(fileName);
			expect(message?.innerHTML).toContain("has been modified on disk");

			// Check buttons exist
			const overwriteBtn = dialog?.querySelector(".overwrite-btn");
			const refreshBtn = dialog?.querySelector(".refresh-btn");
			const cancelBtn = dialog?.querySelector(".cancel-btn");

			expect(overwriteBtn).not.toBeNull();
			expect(refreshBtn).not.toBeNull();
			expect(cancelBtn).not.toBeNull();

			// Clean up by clicking cancel
			(cancelBtn as HTMLElement)?.click();
			await dialogPromise;
		});

		it("should resolve with 'overwrite' when overwrite button is clicked", async () => {
			const fileName = "test.json";

			const dialogPromise = ConfirmationDialog.showFileConflictDialog(fileName);

			// Wait for dialog to be created
			await new Promise((resolve) => setTimeout(resolve, 0));

			const overwriteBtn = document.querySelector(
				".overwrite-btn"
			) as HTMLElement;
			expect(overwriteBtn).not.toBeNull();

			// Click overwrite button
			overwriteBtn.click();

			const result = await dialogPromise;
			expect(result).toBe("overwrite");

			// Dialog should be removed from DOM
			expect(document.querySelector(".confirmation-overlay")).toBeNull();
		});

		it("should resolve with 'refresh' when refresh button is clicked", async () => {
			const fileName = "test.json";

			const dialogPromise = ConfirmationDialog.showFileConflictDialog(fileName);

			await new Promise((resolve) => setTimeout(resolve, 0));

			const refreshBtn = document.querySelector(".refresh-btn") as HTMLElement;
			expect(refreshBtn).not.toBeNull();

			refreshBtn.click();

			const result = await dialogPromise;
			expect(result).toBe("refresh");

			expect(document.querySelector(".confirmation-overlay")).toBeNull();
		});

		it("should resolve with 'cancel' when cancel button is clicked", async () => {
			const fileName = "test.json";

			const dialogPromise = ConfirmationDialog.showFileConflictDialog(fileName);

			await new Promise((resolve) => setTimeout(resolve, 0));

			const cancelBtn = document.querySelector(".cancel-btn") as HTMLElement;
			expect(cancelBtn).not.toBeNull();

			cancelBtn.click();

			const result = await dialogPromise;
			expect(result).toBe("cancel");

			expect(document.querySelector(".confirmation-overlay")).toBeNull();
		});

		it("should resolve with 'cancel' when Escape key is pressed", async () => {
			const fileName = "test.json";

			const dialogPromise = ConfirmationDialog.showFileConflictDialog(fileName);

			await new Promise((resolve) => setTimeout(resolve, 0));

			// Simulate Escape key press
			const escapeEvent = new KeyboardEvent("keydown", { key: "Escape" });
			document.dispatchEvent(escapeEvent);

			const result = await dialogPromise;
			expect(result).toBe("cancel");

			expect(document.querySelector(".confirmation-overlay")).toBeNull();
		});

		it("should resolve with 'cancel' when overlay is clicked", async () => {
			const fileName = "test.json";

			const dialogPromise = ConfirmationDialog.showFileConflictDialog(fileName);

			await new Promise((resolve) => setTimeout(resolve, 0));

			const overlay = document.querySelector(
				".confirmation-overlay"
			) as HTMLElement;
			expect(overlay).not.toBeNull();

			// Simulate click on overlay (not on dialog)
			const clickEvent = new MouseEvent("click", { bubbles: true });
			Object.defineProperty(clickEvent, "target", { value: overlay });
			overlay.dispatchEvent(clickEvent);

			const result = await dialogPromise;
			expect(result).toBe("cancel");

			expect(document.querySelector(".confirmation-overlay")).toBeNull();
		});

		it("should not close when clicking inside dialog", async () => {
			const fileName = "test.json";

			const dialogPromise = ConfirmationDialog.showFileConflictDialog(fileName);

			await new Promise((resolve) => setTimeout(resolve, 0));

			const dialog = document.querySelector(
				".file-conflict-dialog"
			) as HTMLElement;
			expect(dialog).not.toBeNull();

			// Simulate click on dialog content
			const clickEvent = new MouseEvent("click", { bubbles: true });
			Object.defineProperty(clickEvent, "target", { value: dialog });
			dialog.dispatchEvent(clickEvent);

			// Dialog should still be open
			await new Promise((resolve) => setTimeout(resolve, 100));
			expect(document.querySelector(".confirmation-overlay")).not.toBeNull();

			// Clean up
			const cancelBtn = document.querySelector(".cancel-btn") as HTMLElement;
			cancelBtn.click();
			await dialogPromise;
		});

		it("should focus cancel button by default", async () => {
			const fileName = "test.json";

			const dialogPromise = ConfirmationDialog.showFileConflictDialog(fileName);

			// Wait for focus timeout
			await new Promise((resolve) => setTimeout(resolve, 150));

			const cancelBtn = document.querySelector(".cancel-btn") as HTMLElement;
			expect(document.activeElement).toBe(cancelBtn);

			// Clean up
			cancelBtn.click();
			await dialogPromise;
		});

		it("should include warning text about overwriting", async () => {
			const fileName = "test.json";

			const dialogPromise = ConfirmationDialog.showFileConflictDialog(fileName);

			await new Promise((resolve) => setTimeout(resolve, 0));

			const warningText = document.querySelector(".warning-text");
			expect(warningText).not.toBeNull();
			expect(warningText?.textContent).toContain("⚠️");
			expect(warningText?.textContent).toContain("Overwriting will replace");

			// Clean up
			const cancelBtn = document.querySelector(".cancel-btn") as HTMLElement;
			cancelBtn.click();
			await dialogPromise;
		});
	});

	describe("File Conflict Detection Integration", () => {
		it("should show conflict dialog when file is modified on disk", async () => {
			// This test verifies the integration pattern used in main.ts
			const fileData: FileData = {
				name: "test.json",
				handle: mockFileHandle,
				type: "json",
				content: {},
				originalContent: "{}",
				lastModified: Date.now() - 10000, // 10 seconds ago
			};

			// Mock file on disk is newer
			mockFile.lastModified = Date.now();

			// Test the integration pattern
			const isModified = await fileHandler.isFileModifiedOnDisk(fileData);
			expect(isModified).toBe(true);

			if (isModified) {
				// This simulates what happens in main.ts
				const dialogPromise = ConfirmationDialog.showFileConflictDialog(
					fileData.name
				);

				await new Promise((resolve) => setTimeout(resolve, 0));

				// Verify dialog is shown
				expect(document.querySelector(".file-conflict-dialog")).not.toBeNull();

				// Simulate user choice
				const overwriteBtn = document.querySelector(
					".overwrite-btn"
				) as HTMLElement;
				overwriteBtn.click();

				const choice = await dialogPromise;
				expect(choice).toBe("overwrite");
			}
		});

		it("should not show conflict dialog when file is not modified", async () => {
			const fileData: FileData = {
				name: "test.json",
				handle: mockFileHandle,
				type: "json",
				content: {},
				originalContent: "{}",
				lastModified: Date.now(),
			};

			// Mock file on disk is same age
			mockFile.lastModified = fileData.lastModified!;

			const isModified = await fileHandler.isFileModifiedOnDisk(fileData);
			expect(isModified).toBe(false);

			// No dialog should be shown in this case
			expect(document.querySelector(".file-conflict-dialog")).toBeNull();
		});

		it("should handle all three dialog choices correctly", async () => {
			const choices: Array<"overwrite" | "refresh" | "cancel"> = [
				"overwrite",
				"refresh",
				"cancel",
			];

			for (const expectedChoice of choices) {
				const fileName = "test.json";
				const dialogPromise =
					ConfirmationDialog.showFileConflictDialog(fileName);

				await new Promise((resolve) => setTimeout(resolve, 0));

				let buttonSelector: string;
				switch (expectedChoice) {
					case "overwrite":
						buttonSelector = ".overwrite-btn";
						break;
					case "refresh":
						buttonSelector = ".refresh-btn";
						break;
					case "cancel":
						buttonSelector = ".cancel-btn";
						break;
				}

				const button = document.querySelector(buttonSelector) as HTMLElement;
				expect(button).not.toBeNull();
				button.click();

				const result = await dialogPromise;
				expect(result).toBe(expectedChoice);
			}
		});
	});

	describe("Error Handling and Edge Cases", () => {
		it("should handle FileSystemFileHandle.getFile() throwing NotAllowedError", async () => {
			const fileData: FileData = {
				name: "test.json",
				handle: mockFileHandle,
				type: "json",
				content: {},
				originalContent: "{}",
				lastModified: Date.now(),
			};

			const notAllowedError = new Error("Permission denied");
			notAllowedError.name = "NotAllowedError";
			mockFileHandle.getFile.mockRejectedValue(notAllowedError);

			const consoleSpy = jest
				.spyOn(console, "warn")
				.mockImplementation(() => {});

			const result = await fileHandler.isFileModifiedOnDisk(fileData);

			expect(result).toBe(false);
			expect(consoleSpy).toHaveBeenCalled();

			consoleSpy.mockRestore();
		});

		it("should handle FileSystemFileHandle.getFile() throwing NotFoundError", async () => {
			const fileData: FileData = {
				name: "test.json",
				handle: mockFileHandle,
				type: "json",
				content: {},
				originalContent: "{}",
				lastModified: Date.now(),
			};

			const notFoundError = new Error("File not found");
			notFoundError.name = "NotFoundError";
			mockFileHandle.getFile.mockRejectedValue(notFoundError);

			const consoleSpy = jest
				.spyOn(console, "warn")
				.mockImplementation(() => {});

			const result = await fileHandler.isFileModifiedOnDisk(fileData);

			expect(result).toBe(false);
			expect(consoleSpy).toHaveBeenCalled();

			consoleSpy.mockRestore();
		});

		it("should handle very large timestamp differences correctly", async () => {
			const fileData: FileData = {
				name: "test.json",
				handle: mockFileHandle,
				type: "json",
				content: {},
				originalContent: "{}",
				lastModified: 1000000, // Very old timestamp
			};

			mockFile.lastModified = Date.now(); // Current timestamp

			const result = await fileHandler.isFileModifiedOnDisk(fileData);

			expect(result).toBe(true);
		});

		it("should handle corrupted/invalid lastModified timestamps", async () => {
			const fileData: FileData = {
				name: "test.json",
				handle: mockFileHandle,
				type: "json",
				content: {},
				originalContent: "{}",
				lastModified: NaN, // Invalid timestamp
			};

			mockFile.lastModified = Date.now();

			const result = await fileHandler.isFileModifiedOnDisk(fileData);

			expect(result).toBe(false); // Should handle gracefully
		});

		it("should handle multiple rapid dialog operations", async () => {
			const fileName = "test.json";

			// Start multiple dialogs rapidly (though in practice only one should be shown)
			const promise1 = ConfirmationDialog.showFileConflictDialog(fileName);
			const promise2 = ConfirmationDialog.showFileConflictDialog(fileName);

			await new Promise((resolve) => setTimeout(resolve, 0));

			// Clean up all dialogs
			const cancelBtns = document.querySelectorAll(".cancel-btn");
			cancelBtns.forEach((btn) => (btn as HTMLElement).click());

			await Promise.all([promise1, promise2]);

			// DOM should be clean
			expect(document.querySelector(".confirmation-overlay")).toBeNull();
		});
	});
});
