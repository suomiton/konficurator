import { KonficuratorApp } from "../../src/main";

function setupDom() {
	document.body.innerHTML = `
    <div id="fileInfo" class="file-info"></div>
    <div id="editorContainer" class="editor-container"></div>
  `;
}

describe("Raw editor toggle and autosave", () => {
	beforeEach(() => {
		setupDom();
	});
	afterEach(() => {
		document.body.innerHTML = "";
		jest.restoreAllMocks();
	});

	it("toggles to raw mode and schedules save on input", async () => {
		const app = new KonficuratorApp();
		const file = {
			id: "r1",
			name: "config.json",
			type: "json",
			group: "G",
			content: { a: 1 },
			originalContent: '{\n  "a": 1\n}',
			handle: null,
			isActive: true,
		} as any;

		(app as any).loadedFiles = [file];
		(app as any).updateFileInfo((app as any).loadedFiles);
		(app as any).renderFileEditors();

		// Click Edit Raw
		const btn = document.querySelector(
			'.toggle-raw-btn[data-id="r1"]'
		) as HTMLButtonElement;
		expect(btn).toBeTruthy();
		btn.click();

		// Raw editor should appear
		const editorEl = document.querySelector('.file-editor[data-id="r1"]')!;
		const raw = editorEl.querySelector(".raw-editor") as HTMLDivElement;
		expect(raw).toBeTruthy();
		const btnAfter = document.querySelector(
			'.toggle-raw-btn[data-id="r1"]'
		) as HTMLButtonElement;
		expect(btnAfter.textContent).toBe("Edit Values");

		// Spy on saveRaw
		const persistence = (app as any).persistence;
		// Assign a spy function in case the method isn't enumerable for spyOn
		(persistence as any).saveRaw = jest.fn().mockResolvedValue(undefined);
		const saveSpy = (persistence as any).saveRaw as jest.Mock;

		// Type into raw editor and trigger input
		raw.textContent = '{\n  "a": 2\n}';
		raw.dispatchEvent(new Event("input"));

		// Fast-forward timers a bit
		await new Promise((r) => setTimeout(r, 700));

		expect(saveSpy).toHaveBeenCalled();
	});
});
