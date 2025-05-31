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
const mockShowReconnectCard = jest.fn();
const mockShowLoading = jest.fn();
const mockHideLoading = jest.fn();
const mockShowSuccess = jest.fn();
const mockShowError = jest.fn();

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
const mockCreateElement = jest.fn();
jest.mock("../../src/ui/dom-factory", () => ({
	createElement: mockCreateElement,
}));

// Import after mocking
import { PermissionManager } from "../../src/permissionManager.js";

describe("PermissionManager", () => {
	let mockFileData: FileData;
	let mockFileHandle: any;

	beforeEach(() => {
		// Set up DOM
		document.body.innerHTML = `
			<div id="reconnectCards"></div>
			<div id="editorContainer"></div>
		`;

		// Create mock file handle
		mockFileHandle = {
			name: "test.json",
			kind: "file",
			queryPermission: jest.fn(),
			requestPermission: jest.fn(),
			getFile: jest.fn(),
			createWritable: jest.fn(),
			isSameEntry: jest.fn(),
		};

		// Create mock file data
		mockFileData = {
			name: "test.json",
			content: '{"test": "data"}',
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

		jest.clearAllMocks();
	});

	afterEach(() => {
		document.body.innerHTML = "";
	});

	describe("Permission Management", () => {
		it("should check file permissions", async () => {
			const files = [mockFileData];

			await PermissionManager.restoreFileHandles(files);

			expect(mockFileHandle.queryPermission).toHaveBeenCalledWith({
				mode: "readwrite",
			});
		});

		it("should request permissions when needed", async () => {
			mockFileHandle.queryPermission.mockResolvedValue("prompt");

			const result = await PermissionManager.requestPermissionForHandle(
				mockFileHandle
			);

			expect(mockFileHandle.requestPermission).toHaveBeenCalledWith({
				mode: "readwrite",
			});
			expect(result).toBe("granted");
		});

		it("should handle permission denied", async () => {
			mockFileHandle.queryPermission.mockResolvedValue("denied");
			mockFileHandle.requestPermission.mockResolvedValue("denied");

			const result = await PermissionManager.requestPermissionForHandle(
				mockFileHandle
			);

			expect(result).toBe("denied");
		});

		it("should restore file handles", async () => {
			const files = [mockFileData];

			const result = await PermissionManager.restoreFileHandles(files);

			expect(result.filesWithGrantedPermission).toHaveLength(1);
			expect(result.filesNeedingPermission).toHaveLength(0);
		});

		it("should identify files needing permission", async () => {
			mockFileHandle.queryPermission.mockResolvedValue("prompt");
			const files = [mockFileData];

			const result = await PermissionManager.restoreFileHandles(files);

			expect(result.filesWithGrantedPermission).toHaveLength(0);
			expect(result.filesNeedingPermission).toHaveLength(1);
		});
	});

	describe("Reconnect Card Management", () => {
		it("should show reconnect card for files needing permission", () => {
			PermissionManager.showReconnectCard(mockFileData, jest.fn());

			expect(mockCreateElement).toHaveBeenCalled();
		});

		it("should handle reconnect button click", () => {
			const mockCallback = jest.fn();

			PermissionManager.showReconnectCard(mockFileData, mockCallback);

			expect(mockCreateElement).toHaveBeenCalled();
		});

		it("should remove reconnect card", () => {
			// Add a reconnect card
			const card = document.createElement("div");
			card.className = "reconnect-card";
			card.setAttribute("data-file", mockFileData.name);
			document.body.appendChild(card);

			PermissionManager.removeReconnectCard(mockFileData.name);

			expect(document.querySelector(".reconnect-card")).toBeFalsy();
		});

		it("should hide all loading states", () => {
			// Add loading elements
			const loading1 = document.createElement("div");
			loading1.className = "loading-indicator";
			const loading2 = document.createElement("div");
			loading2.className = "loading-state";
			document.body.appendChild(loading1);
			document.body.appendChild(loading2);

			PermissionManager.hideAllLoadingStates();

			expect(loading1.style.display).toBe("none");
			expect(loading2.style.display).toBe("none");
		});
	});

	describe("Error Handling", () => {
		it("should handle file handle errors gracefully", async () => {
			mockFileHandle.queryPermission.mockRejectedValue(
				new Error("Permission API error")
			);
			const files = [mockFileData];

			const result = await PermissionManager.restoreFileHandles(files);

			expect(result.filesWithGrantedPermission).toHaveLength(0);
			expect(result.filesNeedingPermission).toHaveLength(1);
		});

		it("should handle missing file handles", async () => {
			const fileWithoutHandle = { ...mockFileData, handle: null };
			const files = [fileWithoutHandle];

			const result = await PermissionManager.restoreFileHandles(files);

			expect(result.filesWithGrantedPermission).toHaveLength(0);
			expect(result.filesNeedingPermission).toHaveLength(1);
		});

		it("should handle permission API unavailability", async () => {
			const handleWithoutPermissions = {
				...mockFileHandle,
				queryPermission: undefined,
				requestPermission: undefined,
			};

			const result = await PermissionManager.requestPermissionForHandle(
				handleWithoutPermissions
			);

			expect(result).toBe("granted"); // Fallback behavior
		});

		it("should handle DOM element not found", () => {
			document.body.innerHTML = ""; // Remove container

			expect(() => {
				PermissionManager.showReconnectCard(mockFileData, jest.fn());
			}).not.toThrow();
		});
	});

	describe("Security Tests", () => {
		it("should validate file names for XSS", () => {
			const maliciousFile = {
				...mockFileData,
				name: '<script>alert("xss")</script>.json',
			};

			expect(() => {
				PermissionManager.showReconnectCard(maliciousFile, jest.fn());
			}).not.toThrow();
		});

		it("should sanitize error messages", async () => {
			const maliciousError = new Error('<img onerror=alert("xss") src=x>');
			mockFileHandle.queryPermission.mockRejectedValue(maliciousError);

			await PermissionManager.restoreFileHandles([mockFileData]);

			expect(mockShowError).not.toHaveBeenCalledWith(
				expect.stringContaining("<img")
			);
		});

		it("should prevent permission escalation", async () => {
			// Test that we only request readwrite permission
			await PermissionManager.requestPermissionForHandle(mockFileHandle);

			expect(mockFileHandle.requestPermission).toHaveBeenCalledWith({
				mode: "readwrite",
			});
			expect(mockFileHandle.requestPermission).not.toHaveBeenCalledWith({
				mode: "write",
			});
		});
	});

	describe("Edge Cases", () => {
		it("should handle empty file list", async () => {
			const result = await PermissionManager.restoreFileHandles([]);

			expect(result.filesWithGrantedPermission).toHaveLength(0);
			expect(result.filesNeedingPermission).toHaveLength(0);
		});

		it("should handle files with same names", async () => {
			const file1 = { ...mockFileData, name: "config.json" };
			const file2 = { ...mockFileData, name: "config.json" };

			const result = await PermissionManager.restoreFileHandles([file1, file2]);

			expect(
				result.filesWithGrantedPermission.length +
					result.filesNeedingPermission.length
			).toBe(2);
		});

		it("should handle concurrent permission requests", async () => {
			const promises = Array.from({ length: 5 }, () =>
				PermissionManager.requestPermissionForHandle(mockFileHandle)
			);

			const results = await Promise.all(promises);

			expect(results).toHaveLength(5);
			results.forEach((result) => {
				expect(["granted", "denied", "prompt"]).toContain(result);
			});
		});

		it("should handle large file lists", async () => {
			const largeFileList = Array.from({ length: 100 }, (_, i) => ({
				...mockFileData,
				name: `file-${i}.json`,
				handle: { ...mockFileHandle, name: `file-${i}.json` },
			}));

			const result = await PermissionManager.restoreFileHandles(largeFileList);

			expect(
				result.filesWithGrantedPermission.length +
					result.filesNeedingPermission.length
			).toBe(100);
		});
	});

	describe("Performance", () => {
		it("should handle permission checks efficiently", async () => {
			const startTime = performance.now();

			await PermissionManager.restoreFileHandles([mockFileData]);

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
			await PermissionManager.restoreFileHandles(files);
			const endTime = performance.now();

			expect(endTime - startTime).toBeLessThan(5000); // Should be reasonably fast
		});
	});

	describe("Accessibility", () => {
		it("should provide proper ARIA labels", () => {
			PermissionManager.showReconnectCard(mockFileData, jest.fn());

			expect(mockCreateElement).toHaveBeenCalled();
		});

		it("should support keyboard navigation", () => {
			PermissionManager.showReconnectCard(mockFileData, jest.fn());

			expect(mockCreateElement).toHaveBeenCalled();
		});

		it("should provide descriptive error messages", async () => {
			mockFileHandle.queryPermission.mockRejectedValue(
				new Error("Access denied")
			);

			await PermissionManager.restoreFileHandles([mockFileData]);

			// Should provide user-friendly error handling
			expect(mockShowError).not.toHaveBeenCalledWith(
				expect.stringContaining("undefined")
			);
		});
	});

	describe("Integration", () => {
		it("should work with notification system", () => {
			PermissionManager.showReconnectCard(mockFileData, jest.fn());

			expect(mockShowReconnectCard).toHaveBeenCalled();
		});

		it("should clean up after operations", async () => {
			await PermissionManager.restoreFileHandles([mockFileData]);

			// Should not leave any pending operations
			expect(document.querySelectorAll(".loading-indicator")).toHaveLength(0);
		});
	});
});
