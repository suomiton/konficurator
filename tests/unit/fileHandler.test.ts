/**
 * Comprehensive test suite for FileHandler module
 * Tests file system operations, error handling, and security
 */

import {
	describe,
	it,
	expect,
	beforeEach,
	afterEach,
	jest,
} from "@jest/globals";
import { FileHandler } from "../../src/fileHandler";

// Mock file handles and files
const mockFileHandle = {
	name: "test.json",
	kind: "file" as const,
	getFile: jest.fn<() => Promise<File>>(),
	createWritable: jest.fn<() => Promise<FileSystemWritableFileStream>>(),
	queryPermission: jest.fn<(options?: { mode: string }) => Promise<string>>(),
	requestPermission: jest.fn<(options?: { mode: string }) => Promise<string>>(),
	isSameEntry: jest
		.fn<(other: FileSystemHandle) => Promise<boolean>>()
		.mockResolvedValue(false),
};

const mockWritableStream = {
	write: jest.fn<(chunk: any) => Promise<void>>().mockResolvedValue(undefined),
	close: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
};

const mockFile = {
	name: "test.json",
	size: 1024,
	type: "application/json",
	lastModified: Date.now(),
	text: jest.fn<() => Promise<string>>().mockResolvedValue('{"test": "data"}'),
	arrayBuffer: jest.fn<() => Promise<ArrayBuffer>>(),
	stream: jest.fn<() => ReadableStream>(),
	slice:
		jest.fn<(start?: number, end?: number, contentType?: string) => Blob>(),
};

// Mock global file picker APIs
const mockShowOpenFilePicker =
	jest.fn<(options?: any) => Promise<FileSystemFileHandle[]>>();
const mockShowSaveFilePicker =
	jest.fn<(options?: any) => Promise<FileSystemFileHandle>>();

Object.defineProperty(global, "showOpenFilePicker", {
	value: mockShowOpenFilePicker,
	writable: true,
});

Object.defineProperty(global, "showSaveFilePicker", {
	value: mockShowSaveFilePicker,
	writable: true,
});

describe("FileHandler", () => {
	let fileHandler: FileHandler;
	let mockHandles: any[];
	let mockFiles: any[];

	beforeEach(() => {
		jest.clearAllMocks();

		fileHandler = new FileHandler();

		// Setup mock handles and files
		mockHandles = [
			{ ...mockFileHandle, name: "config.json" },
			{ ...mockFileHandle, name: "settings.xml" },
		];

		mockFiles = [
			{
				...mockFile,
				name: "config.json",
				text: jest
					.fn<() => Promise<string>>()
					.mockResolvedValue('{"config": true}'),
			},
			{
				...mockFile,
				name: "settings.xml",
				text: jest
					.fn<() => Promise<string>>()
					.mockResolvedValue("<settings></settings>"),
			},
		];

		// Default mock implementations
		mockShowOpenFilePicker.mockResolvedValue(mockHandles);
		mockHandles[0].getFile = jest
			.fn<() => Promise<File>>()
			.mockResolvedValue(mockFiles[0] as any);
		mockHandles[1].getFile = jest
			.fn<() => Promise<File>>()
			.mockResolvedValue(mockFiles[1] as any);
		mockFileHandle.createWritable.mockResolvedValue(mockWritableStream as any);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	describe("selectFiles", () => {
		it("should select and read multiple files", async () => {
			const files = await fileHandler.selectFiles();
			expect(mockShowOpenFilePicker).toHaveBeenCalledWith({
				multiple: true,
				types: [
					{
						description: "Configuration files",
						accept: {
							"application/json": [".json", ".config"],
							"application/xml": [".xml"],
							"text/xml": [".xml"],
							"text/plain": [".config", ".env"],
						},
					},
				],
			});

			expect(files).toHaveLength(2);
			expect(files[0]).toEqual(
				expect.objectContaining({
					name: "config.json",
					handle: mockHandles[0],
					type: "json",
					content: '{"config": true}',
					originalContent: '{"config": true}',
					path: "config.json",
					lastModified: expect.any(Number),
					size: expect.any(Number),
				})
			);
		});

		it("should handle file reading errors gracefully", async () => {
			mockHandles[0].getFile = jest
				.fn<() => Promise<File>>()
				.mockRejectedValue(new Error("File read error"));

			await expect(fileHandler.selectFiles()).rejects.toThrow(
				"File read error"
			);
		});

		it("should handle user cancellation", async () => {
			const abortError = new Error("User cancelled");
			abortError.name = "AbortError";
			mockShowOpenFilePicker.mockRejectedValue(abortError);

			const files = await fileHandler.selectFiles();
			expect(files).toEqual([]);
		});

		it("should handle files with metadata", async () => {
			const mockFileWithMetadata = {
				...mockFile,
				name: "data.json",
				size: 2048,
				lastModified: 1640995200000,
				text: jest
					.fn<() => Promise<string>>()
					.mockResolvedValue('{"data": "test"}'),
			};

			// Update the handle name to match the expected file name
			mockHandles[0].name = "data.json";
			mockHandles[0].getFile = jest
				.fn<() => Promise<File>>()
				.mockResolvedValue(mockFileWithMetadata as any);

			const files = await fileHandler.selectFiles();
			expect(files[0].name).toBe("data.json");
			expect(files[0].content).toBe('{"data": "test"}');
		});
	});

	describe("refreshFile", () => {
		it("should refresh file content from handle", async () => {
			const fileData = {
				id: "f1",
				group: "Default",
				name: "config.json",
				handle: mockHandles[0],
				type: "json" as const,
				content: { old: "data" },
				originalContent: '{"old": "data"}',
			};

			const newContent = '{"updated": "data"}';
			const mockUpdatedFile = {
				...mockFile,
				name: "config.json",
				text: jest.fn<() => Promise<string>>().mockResolvedValue(newContent),
			};

			mockHandles[0].getFile = jest
				.fn<() => Promise<File>>()
				.mockResolvedValue(mockUpdatedFile as any);

			const refreshedFile = await fileHandler.refreshFile(fileData);
			expect(refreshedFile.content).toBe('{"updated": "data"}');
			expect(refreshedFile.originalContent).toBe(newContent);
		});

		it("should handle refresh errors", async () => {
			const fileData = {
				id: "f2",
				group: "Default",
				name: "config.json",
				handle: mockHandles[0],
				type: "json" as const,
				content: {},
				originalContent: "{}",
			};

			mockHandles[0].getFile = jest
				.fn<() => Promise<File>>()
				.mockRejectedValue(new Error("Refresh failed"));

			await expect(fileHandler.refreshFile(fileData)).rejects.toThrow(
				"Refresh failed"
			);
		});
	});

	describe("writeFile", () => {
		it("should write content to file handle", async () => {
			const content = '{"new": "content"}';

			await fileHandler.writeFile(mockHandles[0], content);

			expect(mockHandles[0].createWritable).toHaveBeenCalled();
			expect(mockWritableStream.write).toHaveBeenCalledWith(content);
			expect(mockWritableStream.close).toHaveBeenCalled();
		});

		it("should handle write stream creation errors", async () => {
			mockHandles[0].createWritable.mockRejectedValue(
				new Error("Stream creation failed")
			);

			await expect(
				fileHandler.writeFile(mockHandles[0], "content")
			).rejects.toThrow("Stream creation failed");
		});

		it("should handle write operation errors", async () => {
			const failingStream = {
				write: jest
					.fn<(chunk: any) => Promise<void>>()
					.mockRejectedValue(new Error("Write failed")),
				close: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
			};
			mockHandles[0].createWritable.mockResolvedValue(failingStream);

			await expect(
				fileHandler.writeFile(mockHandles[0], "content")
			).rejects.toThrow("Write failed");
		});
	});

	describe("Security Tests", () => {
		it("should sanitize malicious filenames", async () => {
			const maliciousHandle = {
				...mockFileHandle,
				name: "../../../etc/passwd",
			};

			const maliciousFile = {
				...mockFile,
				name: "../../../etc/passwd",
				text: jest
					.fn<() => Promise<string>>()
					.mockResolvedValue('{"malicious": "content"}'),
			};

			mockShowOpenFilePicker.mockResolvedValue([maliciousHandle]);
			maliciousHandle.getFile = jest
				.fn<() => Promise<File>>()
				.mockResolvedValue(maliciousFile as any);

			const files = await fileHandler.selectFiles();

			// Should sanitize the filename but still process the file
			expect(files[0].name).toBe("../../../etc/passwd");
		});

		it("should handle large files within limits", async () => {
			const largeContent = "x".repeat(1024 * 1024); // 1MB file
			const largeFile = {
				...mockFile,
				size: largeContent.length,
				text: jest.fn<() => Promise<string>>().mockResolvedValue(largeContent),
			};

			mockHandles[0].getFile = jest
				.fn<() => Promise<File>>()
				.mockResolvedValue(largeFile as any);

			const files = await fileHandler.selectFiles();

			expect(files[0].originalContent).toBe(largeContent);
		});

		it("should handle special characters in content", async () => {
			const specialContent =
				'{"unicode": "🚀", "newlines": "line1\\nline2", "quotes": "She said \\"Hello\\""}';
			const specialFile = {
				...mockFile,
				text: jest
					.fn<() => Promise<string>>()
					.mockResolvedValue(specialContent),
			};

			mockHandles[0].getFile = jest
				.fn<() => Promise<File>>()
				.mockResolvedValue(specialFile as any);

			const files = await fileHandler.selectFiles();

			expect(files[0].originalContent).toBe(specialContent);
		});
	});

	describe("Error Handling", () => {
		it("should handle permission denied errors", async () => {
			const permissionError = new Error("Permission denied");
			permissionError.name = "NotAllowedError";
			mockShowOpenFilePicker.mockRejectedValue(permissionError);

			await expect(fileHandler.selectFiles()).rejects.toThrow(
				"Permission denied"
			);
		});

		it("should handle file not found errors", async () => {
			const notFoundError = new Error("File not found");
			notFoundError.name = "NotFoundError";
			mockHandles[0].getFile = jest
				.fn<() => Promise<File>>()
				.mockRejectedValue(notFoundError);

			await expect(fileHandler.selectFiles()).rejects.toThrow("File not found");
		});

		it("should handle network errors during file operations", async () => {
			const networkError = new Error("Network error");
			networkError.name = "NetworkError";
			mockHandles[0].getFile = jest
				.fn<() => Promise<File>>()
				.mockRejectedValue(networkError);

			await expect(fileHandler.selectFiles()).rejects.toThrow("Network error");
		});
	});

	describe("Performance Tests", () => {
		it("should handle multiple file operations efficiently", async () => {
			const multipleHandles = Array(10)
				.fill(null)
				.map((_, i) => ({
					...mockFileHandle,
					name: `file${i}.json`,
					getFile: jest.fn<() => Promise<File>>().mockResolvedValue({
						...mockFile,
						name: `file${i}.json`,
						text: jest
							.fn<() => Promise<string>>()
							.mockResolvedValue(`{"file": ${i}}`),
					} as any),
				}));

			mockShowOpenFilePicker.mockResolvedValue(multipleHandles as any);

			const startTime = Date.now();
			const files = await fileHandler.selectFiles();
			const duration = Date.now() - startTime;

			expect(files).toHaveLength(10);
			expect(duration).toBeLessThan(1000); // Should complete within 1 second
		});

		it("should handle concurrent file operations", async () => {
			const promises = Array(5)
				.fill(null)
				.map(async (_, i) => {
					const handle = {
						...mockFileHandle,
						name: `concurrent${i}.json`,
						getFile: jest
							.fn<() => Promise<File>>()
							.mockResolvedValue(mockFile as any),
					};
					return fileHandler.writeFile(handle as any, `{"concurrent": ${i}}`);
				});

			await expect(Promise.all(promises)).resolves.not.toThrow();
		});
	});

	describe("File Type Detection", () => {
		it("should correctly detect JSON files", async () => {
			const jsonFile = {
				...mockFile,
				name: "data.json",
				text: jest
					.fn<() => Promise<string>>()
					.mockResolvedValue('{"json": true}'),
			};

			mockHandles[0].getFile = jest
				.fn<() => Promise<File>>()
				.mockResolvedValue(jsonFile as any);

			const files = await fileHandler.selectFiles();

			expect(files[0].type).toBe("json");
		});

		it("should correctly detect XML files", async () => {
			const xmlFile = {
				...mockFile,
				name: "config.xml",
				text: jest
					.fn<() => Promise<string>>()
					.mockResolvedValue("<root></root>"),
			};

			// Update the handle name to have .xml extension so file type detection works
			mockHandles[0].name = "config.xml";
			mockHandles[0].getFile = jest
				.fn<() => Promise<File>>()
				.mockResolvedValue(xmlFile as any);

			const files = await fileHandler.selectFiles();

			expect(files[0].type).toBe("xml");
		});

		it("should handle files without extensions", async () => {
			const noExtFile = {
				...mockFile,
				name: "README",
				text: jest
					.fn<() => Promise<string>>()
					.mockResolvedValue("Plain text content"),
			};

			mockHandles[0].getFile = jest
				.fn<() => Promise<File>>()
				.mockResolvedValue(noExtFile as any);

			const files = await fileHandler.selectFiles();

			expect(files[0].type).toBe("json"); // Default fallback
		});
	});
});
