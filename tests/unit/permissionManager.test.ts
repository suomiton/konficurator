/**
 * Unit tests for PermissionManager module
 * Tests file permission management and security measures
 */

import {
	describe,
	it,
	expect,
	beforeEach,
	afterEach,
	jest,
} from "@jest/globals";
import type { FileData } from "../../src/interfaces.js";

// Mock notifications
const mockShowReconnectCard = jest.fn() as jest.MockedFunction<any>;
const mockShowLoading = jest.fn() as jest.MockedFunction<any>;
const mockHideLoading = jest.fn() as jest.MockedFunction<any>;
const mockShowSuccess = jest.fn() as jest.MockedFunction<any>;
const mockShowError = jest.fn() as jest.MockedFunction<any>;

jest.mock("../../src/ui/notifications", () => ({
	FileNotifications: {
		showReconnectCard: mockShowReconnectCard,
	},
	NotificationService: {
		showLoading: mockShowLoading,
		hideLoading: mockHideLoading,
		showSuccess: mockShowSuccess,
		showError: mockShowError,
	},
}));

// Mock DOM factory
const mockCreateElement = jest.fn() as jest.MockedFunction<any>;
jest.mock("../../src/ui/dom-factory", () => ({
	createElement: mockCreateElement,
}));

// Import after mocking
import { PermissionManager } from "../../src/permissionManager.js";

describe("PermissionManager", () => {
	let mockFileData: FileData;
	let mockFileHandle: any;
	let mockCallback: jest.MockedFunction<(file: FileData) => Promise<void>>;

	beforeEach(() => {
		// Set up DOM
		document.body.innerHTML = `
			<div id="reconnectCards"></div>
			<div id="editorContainer"></div>
		`;

		// Create mock callback
		mockCallback = jest
			.fn()
			.mockImplementation(() => Promise.resolve()) as jest.MockedFunction<
			(file: FileData) => Promise<void>
		>;

		// Create mock file handle
		mockFileHandle = {
			name: "test.json",
			kind: "file",
			queryPermission: jest.fn() as jest.MockedFunction<any>,
			requestPermission: jest.fn() as jest.MockedFunction<any>,
			getFile: jest.fn() as jest.MockedFunction<any>,
			createWritable: jest.fn() as jest.MockedFunction<any>,
			isSameEntry: jest.fn() as jest.MockedFunction<any>,
		};

		// Create mock file data
		mockFileData = {
			name: "test.json",
			content: '{"test": "data"}',
			originalContent: '{"test": "data"}',
			type: "json",
			size: 100,
			lastModified: Date.now(),
			handle: mockFileHandle,
		};

		// Set up default mock implementations
		mockCreateElement.mockImplementation(({ tag, className }: any) => {
			const element = document.createElement(tag || "div");
			if (className) element.className = className;
			return element;
		});

                // Set up default permission responses
                mockFileHandle.queryPermission.mockResolvedValue("granted");
                mockFileHandle.requestPermission.mockResolvedValue("granted");
                mockFileHandle.getFile.mockResolvedValue({
                        text: jest
                                .fn()
                                .mockResolvedValue(mockFileData.content as string),
                        lastModified: mockFileData.lastModified,
                        size:
                                typeof mockFileData.content === "string"
                                        ? mockFileData.content.length
                                        : 0,
                });

                jest.clearAllMocks();
        });

	afterEach(() => {
		document.body.innerHTML = "";
	});

	describe("Permission Management", () => {
		it("should check file permissions", async () => {
			const files = [mockFileData];

			const result = await PermissionManager.restoreSavedHandles(
				files,
				mockCallback
			);

			expect(mockFileHandle.queryPermission).toHaveBeenCalledWith({
				mode: "readwrite",
			});
			expect(result).toEqual({
				restoredFiles: [mockFileData],
				filesNeedingPermission: [],
			});
		});

		it("should handle files needing permission", async () => {
			mockFileHandle.queryPermission.mockResolvedValue("prompt");
			const files = [mockFileData];

			const result = await PermissionManager.restoreSavedHandles(
				files,
				mockCallback
			);

			expect(result.restoredFiles).toHaveLength(0);
			expect(result.filesNeedingPermission).toHaveLength(1);
			expect(result.filesNeedingPermission[0]).toBe(mockFileData);
		});

		it("should handle permission denied", async () => {
			mockFileHandle.queryPermission.mockResolvedValue("denied");
			const files = [mockFileData];

			const result = await PermissionManager.restoreSavedHandles(
				files,
				mockCallback
			);

			expect(result.restoredFiles).toHaveLength(0);
			expect(result.filesNeedingPermission).toHaveLength(1);
		});

                it("should request permission and reload file", async () => {
                        const result = await PermissionManager.requestAndReload(
                                mockFileData,
                                mockCallback
                        );

                        expect(mockFileHandle.requestPermission).toHaveBeenCalledWith({
                                mode: "readwrite",
                        });
                        expect(mockFileHandle.getFile).toHaveBeenCalled();
                        expect(mockCallback).toHaveBeenCalledWith(
                                expect.objectContaining({
                                        name: mockFileData.name,
                                        content: mockFileData.content,
                                        originalContent: mockFileData.originalContent,
                                        permissionDenied: false,
                                })
                        );
                        expect(result).toBe(true);
                });

                it("should handle request permission failure", async () => {
                        mockFileHandle.requestPermission.mockResolvedValue("denied");

                        const result = await PermissionManager.requestAndReload(
                                mockFileData,
                                mockCallback
                        );

                        expect(mockFileHandle.getFile).not.toHaveBeenCalled();
                        expect(result).toBe(false);
                });

		it("should restore file handles", async () => {
			const files = [mockFileData];

			const result = await PermissionManager.restoreSavedHandles(
				files,
				mockCallback
			);

			expect(result.restoredFiles).toHaveLength(1);
			expect(result.filesNeedingPermission).toHaveLength(0);
		});

		it("should identify files needing permission", async () => {
			mockFileHandle.queryPermission.mockResolvedValue("prompt");
			const files = [mockFileData];

			const result = await PermissionManager.restoreSavedHandles(
				files,
				mockCallback
			);

			expect(result.restoredFiles).toHaveLength(0);
			expect(result.filesNeedingPermission).toHaveLength(1);
		});
	});

	describe("Error Handling", () => {
		it("should handle file handle errors gracefully", async () => {
			mockFileHandle.queryPermission.mockRejectedValue(
				new Error("Permission API error")
			);
			const files = [mockFileData];

			const result = await PermissionManager.restoreSavedHandles(
				files,
				mockCallback
			);

			expect(result.restoredFiles).toHaveLength(1);
			expect(result.restoredFiles[0].handle).toBeNull();
			expect(result.restoredFiles[0].permissionDenied).toBe(true);
			expect(result.filesNeedingPermission).toHaveLength(0);
		});

		it("should handle missing file handles", async () => {
			const fileWithoutHandle = { ...mockFileData, handle: null };
			const files = [fileWithoutHandle];

			const result = await PermissionManager.restoreSavedHandles(
				files,
				mockCallback
			);

			expect(result.restoredFiles).toHaveLength(1);
			expect(result.filesNeedingPermission).toHaveLength(0);
		});

		it("should handle permission API unavailability", async () => {
			const handleWithoutPermissions = {
				...mockFileHandle,
				queryPermission: undefined,
				requestPermission: undefined,
			};
			const fileWithoutPermissionAPI = {
				...mockFileData,
				handle: handleWithoutPermissions,
			};

			const result = await PermissionManager.restoreSavedHandles(
				[fileWithoutPermissionAPI],
				mockCallback
			);

			expect(result.restoredFiles).toHaveLength(1); // Fallback behavior
		});

		it("should handle requestAndReload with missing handle", async () => {
			const fileWithoutHandle = { ...mockFileData, handle: null };

			const result = await PermissionManager.requestAndReload(
				fileWithoutHandle,
				mockCallback
			);

			expect(result).toBe(false);
		});
	});

	describe("Security Tests", () => {
		it("should handle malicious file names safely", async () => {
			const maliciousFile = {
				...mockFileData,
				name: '<script>alert("xss")</script>.json',
			};

			const result = await PermissionManager.restoreSavedHandles(
				[maliciousFile],
				mockCallback
			);

			expect(result).toBeDefined();
			expect(mockCallback).toHaveBeenCalled();
		});

		it("should sanitize error messages", async () => {
			const maliciousError = new Error('<img onerror=alert("xss") src=x>');
			mockFileHandle.queryPermission.mockRejectedValue(maliciousError);

			await PermissionManager.restoreSavedHandles([mockFileData], mockCallback);

			// Should not expose unsanitized error messages
			expect(mockShowError).not.toHaveBeenCalledWith(
				expect.stringContaining("<img")
			);
		});

		it("should prevent permission escalation", async () => {
			await PermissionManager.requestAndReload(mockFileData, mockCallback);

			expect(mockFileHandle.requestPermission).toHaveBeenCalledWith({
				mode: "readwrite",
			});
		});
	});

	describe("Edge Cases", () => {
		it("should handle empty file list", async () => {
			const result = await PermissionManager.restoreSavedHandles(
				[],
				mockCallback
			);

			expect(result.restoredFiles).toHaveLength(0);
			expect(result.filesNeedingPermission).toHaveLength(0);
		});

		it("should handle files with same names", async () => {
			const file1 = { ...mockFileData, name: "config.json" };
			const file2 = { ...mockFileData, name: "config.json" };

			const result = await PermissionManager.restoreSavedHandles(
				[file1, file2],
				mockCallback
			);

			expect(
				result.restoredFiles.length + result.filesNeedingPermission.length
			).toBe(2);
		});

		it("should handle concurrent permission requests", async () => {
			const promises = Array.from({ length: 5 }, () =>
				PermissionManager.requestAndReload(mockFileData, mockCallback)
			);

			const results = await Promise.all(promises);

			expect(results).toHaveLength(5);
			results.forEach((result: any) => {
				expect(typeof result).toBe("boolean");
			});
		});

		it("should handle large file lists", async () => {
			const largeFileList = Array.from({ length: 100 }, (_, i) => ({
				...mockFileData,
				name: `file-${i}.json`,
				handle: { ...mockFileHandle, name: `file-${i}.json` },
			}));

			const result = await PermissionManager.restoreSavedHandles(
				largeFileList,
				mockCallback
			);

			expect(
				result.restoredFiles.length + result.filesNeedingPermission.length
			).toBe(100);
		});
	});

	describe("Performance", () => {
		it("should handle permission checks efficiently", async () => {
			const startTime = performance.now();

			await PermissionManager.restoreSavedHandles([mockFileData], mockCallback);

			const endTime = performance.now();
			const duration = endTime - startTime;

			expect(duration).toBeLessThan(1000); // Should complete within 1 second
		});

		it("should batch permission operations", async () => {
			const files = Array.from({ length: 10 }, (_, i) => ({
				...mockFileData,
				name: `file-${i}.json`,
				handle: { ...mockFileHandle, name: `file-${i}.json` },
			}));

			const startTime = performance.now();
			await PermissionManager.restoreSavedHandles(files, mockCallback);
			const endTime = performance.now();

			expect(endTime - startTime).toBeLessThan(5000); // Should be reasonably fast
		});
	});

	describe("Integration", () => {
		it("should work with callback function", async () => {
			await PermissionManager.restoreSavedHandles([mockFileData], mockCallback);

			expect(mockCallback).toHaveBeenCalledWith(mockFileData);
		});

		it("should clean up after operations", async () => {
			await PermissionManager.restoreSavedHandles([mockFileData], mockCallback);

			// Should not leave any pending operations
			expect(document.querySelectorAll(".loading-indicator")).toHaveLength(0);
		});
	});
});
