import { jest } from "@jest/globals";
import { KonficuratorApp } from "../../src/main";
import { FileData } from "../../src/interfaces";

function createDomScaffold() {
	document.body.innerHTML = `
		<div id="fileInfo" class="file-info"></div>
		<div id="editorContainer" class="editor-container"></div>
	`; // minimal skeleton
}

describe("Header action buttons integration", () => {
	beforeEach(() => {
		createDomScaffold();
	});

	afterEach(() => {
		jest.restoreAllMocks();
		document.body.innerHTML = "";
	});

	function makeFile(overrides: Partial<FileData> = {}): FileData {
		const base: FileData = {
			id: overrides.id || "f1",
			name: overrides.name || "config.json",
			type: overrides.type || "json",
			content: overrides.content || { a: 1 },
			originalContent: overrides.originalContent || '{"a":1}',
			group: overrides.group || "Group 1",
			handle: overrides.handle ?? null,
			isActive: overrides.isActive !== false,
		};
		if (overrides.groupColor) (base as any).groupColor = overrides.groupColor;
		if (overrides.lastModified) base.lastModified = overrides.lastModified;
		return base;
	}

	test("minimize button hides editor and marks chip inactive", () => {
		const app = new KonficuratorApp();
		(app as any).loadedFiles = [makeFile({ id: "file-1" })];
		(app as any).updateFileInfo((app as any).loadedFiles);
		(app as any).renderFileEditors();

		const editor = document.querySelector('.file-editor[data-id="file-1"]');
		expect(editor).toBeTruthy();

		const minimizeBtn = document.querySelector(
			'.minimize-file-btn[data-id="file-1"]'
		) as HTMLButtonElement;
		expect(minimizeBtn).toBeTruthy();

		// Click the inner icon span to test delegation
		const iconSpan = minimizeBtn.querySelector("span");
		(iconSpan || minimizeBtn).dispatchEvent(
			new MouseEvent("click", { bubbles: true })
		);

		// Editor should be gone after toggle
		const editorAfter = document.querySelector(
			'.file-editor[data-id="file-1"]'
		);
		expect(editorAfter).toBeNull();

		// Chip should exist and have inactive class
		const chip = document.querySelector('.file-tag[data-id="file-1"]');
		expect(chip).toBeTruthy();
		expect(chip?.classList.contains("inactive")).toBe(true);
	});

	test("remove button deletes file from loadedFiles and DOM", async () => {
		const app = new KonficuratorApp();
		(app as any).loadedFiles = [makeFile({ id: "file-2" })];
		(app as any).updateFileInfo((app as any).loadedFiles);
		(app as any).renderFileEditors();

		const removeBtn = document.querySelector(
			'.remove-file-btn[data-id="file-2"]'
		) as HTMLButtonElement;
		expect(removeBtn).toBeTruthy();
		removeBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		// Allow async removal chain (multiple awaits inside) to complete
		await new Promise((r) => setTimeout(r, 0));
		await new Promise((r) => setTimeout(r, 0));

		// Should remove from DOM
		const editorAfter = document.querySelector(
			'.file-editor[data-id="file-2"]'
		);
		expect(editorAfter).toBeNull();
		// Internal state updated
		expect(
			(app as any).loadedFiles.find((f: FileData) => f.id === "file-2")
		).toBeUndefined();
	});
});
