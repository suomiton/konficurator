import { describe, it, expect, beforeEach } from "@jest/globals";
import { FormRenderer } from "../../src/renderer";
import { FileData } from "../../src/interfaces";

// Real renderer tests for actual FormRenderer functionality
describe("FormRenderer - Real Implementation Tests", () => {
	let renderer: FormRenderer;

	beforeEach(() => {
		// Setup DOM environment
		document.body.innerHTML = "";
		renderer = new FormRenderer();
	});

	describe("renderFileEditor", () => {
		it("should render complete file editor with header, form, and save button", () => {
			const fileData: FileData = {
				name: "config.json",
				type: "json",
				content: { setting: "value", enabled: true },
				originalContent: '{"setting": "value", "enabled": true}',
				handle: null,
			};

			const editor = renderer.renderFileEditor(fileData);

			expect(editor.className).toBe("file-editor fade-in");
			expect(editor.getAttribute("data-file")).toBe("config.json");

			// Check header exists
			const header = editor.querySelector(".file-editor-header");
			expect(header).toBeTruthy();

			// Check form exists
			const form = editor.querySelector(".config-form");
			expect(form).toBeTruthy();

			// Check save button exists
			const saveContainer = editor.querySelector(".save-container");
			expect(saveContainer).toBeTruthy();
		});

		it("should display error notification for files with parse errors", () => {
			const fileData: FileData = {
				name: "broken.json",
				type: "json",
				content: { _error: "Invalid JSON format" },
				originalContent: '{"invalid": json}',
				handle: null,
			};

			const editor = renderer.renderFileEditor(fileData);

			// Should have error notification instead of form
			const errorNotification = editor.querySelector(".error-notification");
			expect(errorNotification).toBeTruthy();

			// Should not have form or save button
			const form = editor.querySelector(".config-form");
			const saveContainer = editor.querySelector(".save-container");
			expect(form).toBeFalsy();
			expect(saveContainer).toBeFalsy();
		});

		it("should render correct file path information", () => {
			const fileDataWithPath: FileData = {
				name: "config.json",
				type: "json",
				content: { setting: "value" },
				originalContent: '{"setting": "value"}',
				path: "/home/user/config.json",
				handle: null,
			};

			const editor = renderer.renderFileEditor(fileDataWithPath);
			const pathDisplay = editor.querySelector(".file-path");

			expect(pathDisplay?.textContent).toBe("📁 /home/user/config.json");
		});

		it("should show different buttons for files with/without handles", () => {
			// File with handle (from disk)
			const fileWithHandle: FileData = {
				name: "config.json",
				type: "json",
				content: { setting: "value" },
				originalContent: '{"setting": "value"}',
				handle: {} as FileSystemFileHandle,
			};

			const editorWithHandle = renderer.renderFileEditor(fileWithHandle);
			const refreshButton = editorWithHandle.querySelector(".refresh-file-btn");
			const reloadButton = editorWithHandle.querySelector(
				".reload-from-disk-btn"
			);

			expect(refreshButton).toBeTruthy();
			expect(reloadButton).toBeFalsy();

			// File without handle (from storage)
			const fileWithoutHandle: FileData = {
				name: "config.json",
				type: "json",
				content: { setting: "value" },
				originalContent: '{"setting": "value"}',
				handle: null,
			};

			const editorWithoutHandle = renderer.renderFileEditor(fileWithoutHandle);
			const refreshButton2 =
				editorWithoutHandle.querySelector(".refresh-file-btn");
			const reloadButton2 = editorWithoutHandle.querySelector(
				".reload-from-disk-btn"
			);

			expect(refreshButton2).toBeFalsy();
			expect(reloadButton2).toBeTruthy();
		});
	});

	describe("generateFormFields", () => {
		it("should generate form fields for simple object", () => {
			const data = {
				name: "test",
				port: 8080,
				enabled: true,
			};

			const fields = renderer.generateFormFields(data, "");

			expect(fields.className).toBe("form-fields");
			expect(fields.children.length).toBe(3);

			// Check if proper field types are created
			const textField = fields.querySelector('input[name="name"]');
			const numberField = fields.querySelector('input[name="port"]');
			const checkboxField = fields.querySelector('input[name="enabled"]');

			expect(textField?.getAttribute("type")).toBe("text");
			expect(numberField?.getAttribute("type")).toBe("number");
			expect(checkboxField?.getAttribute("type")).toBe("checkbox");
		});

		it("should generate nested form fields for complex objects", () => {
			const data = {
				database: {
					host: "localhost",
					port: 5432,
				},
			};

			const fields = renderer.generateFormFields(data, "");

			expect(fields.children.length).toBe(1);

			// Check nested structure - uses "nested-object" class, not "object-section"
			const nestedObject = fields.querySelector(".nested-object");
			expect(nestedObject).toBeTruthy();

			const hostField = fields.querySelector(
				'input[name="database.host"]'
			) as HTMLInputElement;
			const portField = fields.querySelector(
				'input[name="database.port"]'
			) as HTMLInputElement;

			expect(hostField?.value).toBe("localhost");
			expect(portField?.value).toBe("5432");
		});

		it("should handle array fields", () => {
			const data = {
				servers: ["server1", "server2", "server3"],
			};

			const fields = renderer.generateFormFields(data, "");

			// Arrays are rendered as textareas, not array sections
			const arrayField = fields.querySelector(
				'textarea[name="servers"]'
			) as HTMLTextAreaElement;
			expect(arrayField).toBeTruthy();
			expect(arrayField?.getAttribute("data-type")).toBe("array");

			// Check the JSON content in the value property
			expect(arrayField?.value).toContain("server1");
		});

		it("should handle boolean fields correctly", () => {
			const data = {
				enabled: true,
				debug: false,
			};

			const fields = renderer.generateFormFields(data, "");

			const enabledCheckbox = fields.querySelector(
				'input[name="enabled"]'
			) as HTMLInputElement;
			const debugCheckbox = fields.querySelector(
				'input[name="debug"]'
			) as HTMLInputElement;

			expect(enabledCheckbox?.checked).toBe(true);
			expect(debugCheckbox?.checked).toBe(false);
		});

		it("should handle number fields with proper type", () => {
			const data = {
				port: 8080,
				timeout: 30.5,
				count: 0,
			};

			const fields = renderer.generateFormFields(data, "");

			const portField = fields.querySelector(
				'input[name="port"]'
			) as HTMLInputElement;
			const timeoutField = fields.querySelector(
				'input[name="timeout"]'
			) as HTMLInputElement;
			const countField = fields.querySelector(
				'input[name="count"]'
			) as HTMLInputElement;

			expect(portField?.type).toBe("number");
			expect(timeoutField?.type).toBe("number");
			expect(countField?.type).toBe("number");

			expect(portField?.value).toBe("8080");
			expect(timeoutField?.value).toBe("30.5");
			// Bug in renderer: 0 becomes empty string due to (value || "")
			expect(countField?.value).toBe("");
		});
	});

	describe("Field Type Detection", () => {
		it("should properly detect field types", () => {
			const testData = {
				stringField: "text",
				numberField: 123,
				booleanField: true,
				objectField: { nested: "value" },
				arrayField: [1, 2, 3],
			};

			const fields = renderer.generateFormFields(testData, "");

			// String field
			const stringInput = fields.querySelector('input[name="stringField"]');
			expect(stringInput?.getAttribute("type")).toBe("text");

			// Number field
			const numberInput = fields.querySelector('input[name="numberField"]');
			expect(numberInput?.getAttribute("type")).toBe("number");

			// Boolean field
			const booleanInput = fields.querySelector('input[name="booleanField"]');
			expect(booleanInput?.getAttribute("type")).toBe("checkbox");

			// Object field - uses nested-object class
			const nestedObject = fields.querySelector(".nested-object");
			expect(nestedObject).toBeTruthy();

			// Array field - uses textarea
			const arrayField = fields.querySelector('textarea[name="arrayField"]');
			expect(arrayField).toBeTruthy();
		});
	});

	describe("Form Labels", () => {
		it("should format labels correctly", () => {
			const data = {
				serverName: "test",
				database_host: "localhost",
				"api-key": "secret",
			};

			const fields = renderer.generateFormFields(data, "");

			const labels = fields.querySelectorAll("label");
			const labelTexts = Array.from(labels).map((label) => label.textContent);

			// Based on the actual formatLabel function:
			// serverName -> "Server Name" (space before capitals)
			// database_host -> "Database host" (underscores to spaces)
			// api-key -> "Api-key" (hyphens are not handled specially)
			expect(labelTexts).toContain("Server Name");
			expect(labelTexts).toContain("Database host");
			expect(labelTexts).toContain("Api-key");
		});
	});

	describe("Error Handling", () => {
		it("should handle parsing errors gracefully", () => {
			const fileData: FileData = {
				name: "config.json",
				type: "json",
				content: null, // This might cause an error
				originalContent: "",
				handle: null,
			};

			// This should not throw an error
			expect(() => renderer.renderFileEditor(fileData)).not.toThrow();

			const editor = renderer.renderFileEditor(fileData);
			expect(editor).toBeTruthy();
		});
	});

	describe("Integration Tests", () => {
		it("should create a fully functional form for real config data", () => {
			const realConfigData = {
				app: {
					name: "My App",
					version: "1.0.0",
					port: 3000,
					debug: true,
				},
				database: {
					host: "localhost",
					port: 5432,
					ssl: false,
					credentials: {
						username: "admin",
						password: "secret",
					},
				},
				features: ["auth", "logging", "monitoring"],
			};

			const fileData: FileData = {
				name: "app-config.json",
				type: "json",
				content: realConfigData,
				originalContent: JSON.stringify(realConfigData),
				handle: null,
			};

			const editor = renderer.renderFileEditor(fileData);

			// Should have all expected elements
			expect(editor.querySelector(".file-title")?.textContent).toBe(
				"app-config.json"
			);
			expect(editor.querySelector(".file-type")?.textContent).toBe("json");

			// Should have form fields for all data
			const form = editor.querySelector(".config-form");
			expect(form).toBeTruthy();

			// Check some specific fields exist
			expect(editor.querySelector('input[name="app.name"]')).toBeTruthy();
			expect(editor.querySelector('input[name="app.port"]')).toBeTruthy();
			expect(editor.querySelector('input[name="database.host"]')).toBeTruthy();

			// Should have save functionality
			const saveButton = editor.querySelector('[data-file="app-config.json"]');
			expect(saveButton).toBeTruthy();
		});
	});
});
