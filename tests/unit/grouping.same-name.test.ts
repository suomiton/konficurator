import { KonficuratorApp } from "../../src/main";
import { FileData } from "../../src/interfaces";

function scaffoldDom() {
	document.body.innerHTML = `
    <div id="fileInfo" class="file-info"></div>
    <div id="editorContainer" class="editor-container"></div>
  `;
}

describe("Grouping: supports identical filenames across different groups", () => {
	beforeEach(() => {
		scaffoldDom();
	});

	afterEach(() => {
		document.body.innerHTML = "";
	});

	function makeFile(
		id: string,
		group: string,
		overrides: Partial<FileData> = {}
	): FileData {
		return {
			id,
			name: overrides.name || "config.json",
			type: overrides.type || "json",
			group,
			content: overrides.content || { a: 1 },
			originalContent: overrides.originalContent || '{"a":1}',
			handle: overrides.handle ?? null,
			isActive: overrides.isActive !== false,
		} as FileData;
	}

	it("renders two editors and two chips for files with the same name in different groups", () => {
		const app = new KonficuratorApp();

		// Prepare two files with identical names but different groups and ids
		const f1 = makeFile("id-a", "Group A", { name: "config.json" });
		const f2 = makeFile("id-b", "Group B", { name: "config.json" });

		(app as any).loadedFiles = [f1, f2];

		// Update UI and render editors
		(app as any).updateFileInfo((app as any).loadedFiles);
		(app as any).renderFileEditors();

		// Expect two editors present with distinct ids
		const editorA = document.querySelector('.file-editor[data-id="id-a"]');
		const editorB = document.querySelector('.file-editor[data-id="id-b"]');
		expect(editorA).toBeTruthy();
		expect(editorB).toBeTruthy();
		expect(editorA).not.toBe(editorB);

		// Expect two chips with the same visible name but different data-ids
		const chips = Array.from(
			document.querySelectorAll(".file-tag")
		) as HTMLElement[];
		const namedChips = chips.filter((ch) => ch.textContent === "config.json");
		expect(namedChips.length).toBeGreaterThanOrEqual(2);
		const ids = new Set(namedChips.map((ch) => ch.getAttribute("data-id")));
		expect(ids.has("id-a")).toBe(true);
		expect(ids.has("id-b")).toBe(true);

		// Groups should be rendered separately
		const groupTitles = Array.from(
			document.querySelectorAll(".file-group-title")
		).map((el) => el.textContent);
		expect(groupTitles).toContain("Group A");
		expect(groupTitles).toContain("Group B");
	});
});
