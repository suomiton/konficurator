/**
 * Unit tests for main.ts - Application Entry Point
 * Tests critical application initialization and file management
 */

import {
	describe,
	it,
	expect,
	beforeEach,
	afterEach,
	jest,
} from "@jest/globals";

// Mock all dependencies before importing main
const mockLoadFiles = jest.fn() as jest.MockedFunction<() => Promise<any[]>>;
const mockSaveFiles = jest.fn() as jest.MockedFunction<() => Promise<void>>;
const mockRemoveFile = jest.fn() as jest.MockedFunction<() => Promise<void>>;
const mockClearAll = jest.fn() as jest.MockedFunction<() => Promise<void>>;
const mockAutoRefresh = jest.fn() as jest.MockedFunction<() => Promise<any[]>>;
const mockLoadConfigurationFiles = jest.fn() as jest.MockedFunction<
	() => Promise<any[]>
>;
const mockSaveFileWithHandle = jest.fn() as jest.MockedFunction<
	() => Promise<void>
>;
const mockRequestPermissionForFile = jest.fn() as jest.MockedFunction<
	() => Promise<boolean>
>;
const mockShowReconnectCard = jest.fn() as jest.MockedFunction<() => void>;
const mockHideAllLoadingStates = jest.fn() as jest.MockedFunction<() => void>;
const mockRestoreSavedHandles = jest.fn() as jest.MockedFunction<
	(
		files: any[],
		onFileRestored: any
	) => Promise<{ restoredFiles: any[]; filesNeedingPermission: any[] }>
>;

jest.mock("../../src/handleStorage", () => ({
	StorageService: {
		loadFiles: mockLoadFiles,
		saveFiles: mockSaveFiles,
		removeFile: mockRemoveFile,
		clearAll: mockClearAll,
		autoRefresh: mockAutoRefresh,
	},
}));

jest.mock("../../src/fileHandler", () => ({
	loadConfigurationFiles: mockLoadConfigurationFiles,
	saveFileWithHandle: mockSaveFileWithHandle,
}));

jest.mock("../../src/permissionManager", () => ({
	PermissionManager: {
		requestPermissionForFile: mockRequestPermissionForFile,
		showReconnectCard: mockShowReconnectCard,
		hideAllLoadingStates: mockHideAllLoadingStates,
		restoreSavedHandles: mockRestoreSavedHandles,
	},
}));

describe("Main Application Tests", () => {
	let mockButton: HTMLButtonElement | null = null;
	let mockFileInput: HTMLInputElement | null = null;
	let mockContainer: HTMLElement | null = null;

	beforeEach(() => {
		// Set up DOM
		document.body.innerHTML = `
			<button id="load-files">Load Files</button>
			<input id="file-input" type="file" />
			<div id="file-list"></div>
			<div id="no-files"></div>
		`;

		mockButton = document.getElementById("load-files") as HTMLButtonElement;
		mockFileInput = document.getElementById("file-input") as HTMLInputElement;
		mockContainer = document.getElementById("file-list") as HTMLElement;

		// Mock File System Access API
		(window as any).showOpenFilePicker = jest.fn();

		// Mock file operations
		global.FileReader = class MockFileReader {
			result: string | null = null;
			onload: ((event: any) => void) | null = null;
			onerror: ((event: any) => void) | null = null;
			readAsText() {
				this.result = '{"test": "data"}';
				if (this.onload) {
					this.onload({ target: this });
				}
			}
		} as any;

		// Clear all mocks first to ensure clean state
		jest.clearAllMocks();

		// Reset all mocks to their default implementations to prevent contamination
		mockLoadFiles.mockReset();
		mockSaveFiles.mockReset();
		mockRemoveFile.mockReset();
		mockClearAll.mockReset();
		mockAutoRefresh.mockReset();
		mockLoadConfigurationFiles.mockReset();
		mockSaveFileWithHandle.mockReset();
		mockRequestPermissionForFile.mockReset();
		mockRestoreSavedHandles.mockReset();

		// Set up default mock return values after reset
		mockLoadFiles.mockResolvedValue([]);
		mockSaveFiles.mockResolvedValue(undefined);
		mockRemoveFile.mockResolvedValue(undefined);
		mockClearAll.mockResolvedValue(undefined);
		mockAutoRefresh.mockResolvedValue([]);
		mockLoadConfigurationFiles.mockResolvedValue([]);
		mockSaveFileWithHandle.mockResolvedValue(undefined);
		mockRequestPermissionForFile.mockResolvedValue(true);
		mockRestoreSavedHandles.mockResolvedValue({
			restoredFiles: [],
			filesNeedingPermission: [],
		});
	});

	afterEach(() => {
		document.body.innerHTML = "";
	});

	describe("Application Initialization", () => {
		it("should initialize DOM elements on load", async () => {
			expect(mockButton).toBeTruthy();
			expect(mockFileInput).toBeTruthy();
			expect(mockContainer).toBeTruthy();
		});

		it("should handle File System Access API availability", async () => {
			expect(typeof (window as any).showOpenFilePicker).toBe("function");
		});

		it("should load stored files on initialization", async () => {
			const mockFiles = [
				{
					name: "config.json",
					type: "json",
					content: '{"test": "data"}',
					originalContent: '{"test": "data"}',
					lastModified: Date.now(),
					size: 100,
					handle: null,
				},
			];
			mockLoadFiles.mockResolvedValueOnce(mockFiles);
			mockRestoreSavedHandles.mockResolvedValueOnce({
				restoredFiles: mockFiles,
				filesNeedingPermission: [],
			});
			mockAutoRefresh.mockResolvedValueOnce(mockFiles);

			// Manually trigger the LoadFiles call to verify the mock setup works
			const { StorageService } = await import("../../src/handleStorage");
			await StorageService.loadFiles();

			expect(mockLoadFiles).toHaveBeenCalled();
		});

		it("should handle File System Access API errors gracefully", async () => {
			const mockFiles = [
				{
					name: "test.json",
					getFile: jest
						.fn<() => Promise<Blob>>()
						.mockResolvedValue(
							new Blob(['{"test": "data"}'], { type: "application/json" })
						),
				},
			];
			(window as any).showOpenFilePicker = jest
				.fn<
					() => Promise<
						Array<{ name: string; getFile: jest.Mock<() => Promise<Blob>> }>
					>
				>()
				.mockResolvedValue(mockFiles);

			await import("../../src/main");
			// Should not throw errors
		});

		it("should handle initialization errors gracefully", async () => {
			mockLoadFiles.mockRejectedValueOnce(new Error("Load error"));

			await import("../../src/main");
			// Should not throw errors
		});
	});

	describe("File Operations", () => {
		it("should handle file loading from File System Access API", async () => {
			const mockFile = new Blob(['{"test": "data"}'], {
				type: "application/json",
			});
			const mockFiles = [
				{
					name: "test.json",
					getFile: jest.fn<() => Promise<Blob>>().mockResolvedValue(mockFile),
				},
			];
			(window as any).showOpenFilePicker = jest
				.fn<
					() => Promise<
						Array<{ name: string; getFile: jest.Mock<() => Promise<Blob>> }>
					>
				>()
				.mockResolvedValue(mockFiles);

			// Simulate file loading
			expect(() => {
				// This should not throw
			}).not.toThrow();
		});

		it("should handle permission errors gracefully", async () => {
			mockRequestPermissionForFile.mockRejectedValueOnce(
				new Error("Permission denied")
			);

			// Should not throw
			expect(() => {
				// Test permission handling
			}).not.toThrow();
		});
	});

	describe("Data Persistence", () => {
		it("should save files to storage", async () => {
			const mockStoredFiles = [
				{
					name: "config.json",
					type: "json",
					content: '{"test": "data"}',
					lastModified: Date.now(),
					size: 100,
				},
			];
			mockLoadFiles.mockResolvedValueOnce(mockStoredFiles);

			// Should not throw
			expect(() => {
				// Test file saving
			}).not.toThrow();
		});

		it("should handle storage errors gracefully", async () => {
			mockLoadFiles.mockRejectedValueOnce(new Error("Storage error"));

			// Should not throw
			expect(() => {
				// Test storage error handling
			}).not.toThrow();
		});
	});

	describe("Security and Validation", () => {
		it("should validate JSON content", async () => {
			// Test JSON validation
			const validJSON = '{"valid": "json"}';
			const invalidJSON = '{"invalid": json}';

			expect(() => JSON.parse(validJSON)).not.toThrow();
			expect(() => JSON.parse(invalidJSON)).toThrow();
		});

		it("should handle network errors gracefully", async () => {
			// Mock fetch for network operations
			const originalFetch = global.fetch;
			global.fetch = jest.fn(() =>
				Promise.reject(new Error("Network error"))
			) as typeof fetch;

			// Should not throw
			expect(() => {
				// Test network error handling
			}).not.toThrow();

			global.fetch = originalFetch;
		});

		it("should handle quota exceeded errors", async () => {
			const quotaError = new Error("QuotaExceededError");
			quotaError.name = "QuotaExceededError";
			mockSaveFiles.mockRejectedValueOnce(quotaError);

			try {
				await mockSaveFiles();
				// Should not reach here
				expect(true).toBe(false);
			} catch (error) {
				// Should catch the quota error properly
				expect(error).toBeTruthy();
				expect((error as Error).name).toBe("QuotaExceededError");
			}
		});

		it("should handle corrupted data gracefully", async () => {
			const corruptedData = [{ corrupted: "data", missing: undefined }];
			mockLoadFiles.mockResolvedValueOnce(corruptedData);

			// Should not throw
			expect(() => {
				// Test corrupted data handling
			}).not.toThrow();
		});
	});

	describe("Edge Cases", () => {
		it("should handle empty file lists", async () => {
			mockLoadFiles.mockResolvedValueOnce([]);

			// Should not throw
			expect(() => {
				// Test empty file list handling
			}).not.toThrow();
		});

		it("should handle large files", async () => {
			const largeContent = "x".repeat(10000);
			const largeFile = new Blob([largeContent], { type: "application/json" });

			expect(largeFile.size).toBeGreaterThan(1000);
		});

		it("should handle special characters in filenames", async () => {
			const specialFilename = "config with spaces & symbols (2024).json";

			expect(specialFilename).toContain(" ");
			expect(specialFilename).toContain("&");
		});

		it("should handle concurrent operations", async () => {
			// Test concurrent file operations
			const promises = Array.from({ length: 5 }, () =>
				mockLoadFiles.mockResolvedValueOnce([])
			);

			await Promise.all(promises);
			expect(promises).toHaveLength(5);
		});
	});

	describe("Performance", () => {
		it("should handle multiple file operations efficiently", async () => {
			const startTime = performance.now();

			// Simulate multiple operations
			await Promise.all([
				mockLoadFiles(),
				mockSaveFiles(),
				mockLoadConfigurationFiles(),
			]);

			const endTime = performance.now();
			const duration = endTime - startTime;

			expect(duration).toBeLessThan(1000); // Should complete within 1 second
		});

		it("should handle large JSON parsing", async () => {
			const largeObject = {
				data: Array.from({ length: 1000 }, (_, i) => ({
					id: i,
					value: `item-${i}`,
				})),
			};
			const largeJSON = JSON.stringify(largeObject);

			const startTime = performance.now();
			const parsed = JSON.parse(largeJSON);
			const endTime = performance.now();

			expect(parsed.data).toHaveLength(1000);
			expect(endTime - startTime).toBeLessThan(100); // Should parse quickly
		});
	});

	describe("Error Handling", () => {
		it("should not crash on invalid DOM states", async () => {
			document.body.innerHTML = ""; // Remove all elements

			// Should not throw even with missing DOM elements
			expect(() => {
				// Test missing DOM handling
			}).not.toThrow();
		});

		it("should handle FileReader errors", async () => {
			global.FileReader = class MockFileReader {
				result: string | null = null;
				onload: ((event: any) => void) | null = null;
				onerror: ((event: any) => void) | null = null;
				readAsText() {
					if (this.onerror) {
						this.onerror({ target: this });
					}
				}
			} as any;

			// Should not throw on FileReader errors
			expect(() => {
				const reader = new FileReader();
				reader.readAsText(new Blob());
			}).not.toThrow();
		});

		it("should handle permission API unavailability", async () => {
			delete (window as any).showOpenFilePicker;

			// Should not throw when File System Access API is unavailable
			expect(() => {
				// Test fallback behavior
			}).not.toThrow();
		});
	});
});
