import {
	describe,
	it,
	expect,
	beforeEach,
	afterEach,
	jest,
} from "@jest/globals";
import { StorageService } from "../../src/handleStorage";
import { FileData } from "../../src/interfaces";

// Real storage tests for actual StorageService functionality (lightweight, interface-level)
describe("StorageService - Real Implementation Tests", () => {
	beforeEach(() => {
		// Minimal IndexedDB mock sufficient for open()->db()->transaction flow
		const mockObjectStore = {
			put: jest.fn(),
			getAll: jest.fn().mockReturnValue({ onsuccess: null, onerror: null }),
			delete: jest.fn(),
			clear: jest.fn(),
		};
		const mockTransaction = {
			objectStore: jest.fn().mockReturnValue(mockObjectStore),
			oncomplete: null,
			onerror: null,
			onabort: null,
		} as any;
		const mockDB = {
			transaction: jest.fn().mockReturnValue(mockTransaction),
			createObjectStore: jest.fn(),
			objectStoreNames: { contains: jest.fn().mockReturnValue(true) },
		} as any;

		(global as any).indexedDB = {
			open: jest.fn().mockReturnValue({
				result: mockDB,
				error: null,
				onsuccess: null,
				onerror: null,
				onupgradeneeded: null,
			}),
			deleteDatabase: jest.fn(),
		};
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it("exposes expected methods", () => {
		expect(typeof StorageService.saveFiles).toBe("function");
		expect(typeof StorageService.loadFiles).toBe("function");
		expect(typeof StorageService.removeFile).toBe("function");
		expect(typeof StorageService.clearAll).toBe("function");
		expect(typeof StorageService.autoRefreshFiles).toBe("function");
	});

	it("saveFiles accepts FileData[] with id/group fields", () => {
		const files: FileData[] = [
			{
				id: "f-1",
				group: "Default",
				name: "config.json",
				type: "json",
				content: { setting: "value" },
				originalContent: '{"setting":"value"}',
				handle: null,
			},
		];
		expect(() => StorageService.saveFiles(files)).not.toThrow();
	});
});
