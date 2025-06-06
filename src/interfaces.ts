// Core interfaces for the application following Interface Segregation Principle

export interface FileData {
	name: string;
	handle: FileSystemFileHandle | null; // Allow null for restored files
	type: "json" | "xml" | "config" | "env";
	content: any; // Parsed content
	originalContent: string; // Raw string content for storage/saving
	path?: string; // File path information when available
	lastModified?: number; // Last modified timestamp
	size?: number; // File size in bytes
	autoRefreshed?: boolean; // Flag to indicate if file was auto-refreshed from disk
	permissionDenied?: boolean; // Flag to indicate if permission was denied for auto-refresh
	isActive?: boolean; // Flag to indicate if file editor should be visible (defaults to true)
}

export interface ParsedData {
	[key: string]: any;
}

// Parser interface - allows for different parsing strategies
export interface IParser {
	parse(content: string): ParsedData;
	serialize(data: ParsedData): string;
	getFileType(): string;
}

// File handler interface
export interface IFileHandler {
	selectFiles(existingFiles?: FileData[]): Promise<FileData[]>;
	readFile(handle: FileSystemFileHandle): Promise<string>;
	writeFile(handle: FileSystemFileHandle, content: string): Promise<void>;
	refreshFile(fileData: FileData): Promise<FileData>;
	isFileModifiedOnDisk(fileData: FileData): Promise<boolean>;
}

// Renderer interface for UI generation
export interface IRenderer {
	renderFileEditor(fileData: FileData): HTMLElement;
	generateFormFields(data: ParsedData, path: string): HTMLElement;
}

// Persistence interface
export interface IPersistence {
	saveFile(fileData: FileData, formElement: HTMLFormElement): Promise<void>;
}

// Form field types
export type FieldType =
	| "text"
	| "number"
	| "boolean"
	| "object"
	| "array"
	| "xml-heading"
	| "xml-value"
	| "xml-attributes";

export interface FormField {
	type: FieldType;
	value: any;
	path: string;
	label: string;
}
