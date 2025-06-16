// Jest test setup file

// Mock DOM APIs that might not be available in Jest environment
Object.defineProperty(window, "matchMedia", {
	writable: true,
	value: jest.fn().mockImplementation((query) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: jest.fn(), // deprecated
		removeListener: jest.fn(), // deprecated
		addEventListener: jest.fn(),
		removeEventListener: jest.fn(),
		dispatchEvent: jest.fn(),
	})),
});

// Mock WebAssembly module
jest.mock(
	"../parser-wasm/pkg/parser_core.js",
	() => {
		return {
			__esModule: true,
			default: jest.fn().mockResolvedValue(true),
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			update_value: jest
				.fn()
				.mockImplementation((_fileType, content, _path, newVal) => {
					return `${content.substring(0, 10)}...${newVal}...${content.substring(
						content.length - 10
					)}`;
				}),
		};
	},
	{ virtual: true }
);

// Mock File API
(global as any).File = class MockFile {
	constructor(parts: any[], filename: string, properties?: any) {
		this.name = filename;
		this.size = parts.reduce((acc, part) => acc + (part.length || 0), 0);
		this.type = properties?.type || "";
		this.lastModified = Date.now();
	}
	name: string;
	size: number;
	type: string;
	lastModified: number;
	webkitRelativePath = "";
	arrayBuffer = async () => new ArrayBuffer(0);
	bytes = async () => new Uint8Array();
	slice = () => new Blob();
	stream = () => new ReadableStream();
	text = async () => "";
};

// Mock FileReader
(global as any).FileReader = class MockFileReader {
	result: string | ArrayBuffer | null = null;
	error: any = null;
	readyState: number = 0;
	onload: ((event: any) => void) | null = null;
	onerror: ((event: any) => void) | null = null;
	onabort: ((event: any) => void) | null = null;
	onloadstart: ((event: any) => void) | null = null;
	onloadend: ((event: any) => void) | null = null;
	onprogress: ((event: any) => void) | null = null;

	readAsText(_file: any) {
		this.readyState = 2;
		this.result = "mock file content";
		if (this.onload) {
			this.onload({ target: this });
		}
	}

	readAsArrayBuffer(_file: any) {
		this.readyState = 2;
		this.result = new ArrayBuffer(8);
		if (this.onload) {
			this.onload({ target: this });
		}
	}

	abort() {
		this.readyState = 2;
		if (this.onabort) {
			this.onabort({ target: this });
		}
	}

	addEventListener(type: string, listener: any) {
		if (type === "load") this.onload = listener;
		if (type === "error") this.onerror = listener;
		if (type === "abort") this.onabort = listener;
	}

	removeEventListener(type: string, _listener: any) {
		if (type === "load") this.onload = null;
		if (type === "error") this.onerror = null;
		if (type === "abort") this.onabort = null;
	}
};

// Mock IndexedDB for storage tests
const mockIDBRequest = {
	result: null,
	error: null,
	onsuccess: null,
	onerror: null,
	readyState: "done",
	addEventListener: jest.fn(),
	removeEventListener: jest.fn(),
};

(global as any).indexedDB = {
	open: jest.fn().mockReturnValue(mockIDBRequest),
	deleteDatabase: jest.fn().mockReturnValue(mockIDBRequest),
	databases: jest.fn(),
	cmp: jest.fn(),
};
