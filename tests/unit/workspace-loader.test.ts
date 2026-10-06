import { loadPersistedWorkspace } from "../../src/controllers/workspace-loader";
import { StorageService } from "../../src/handleStorage";
import { PermissionManager } from "../../src/permissionManager";
import { FileData } from "../../src/interfaces";

test("restores identical filenames from different groups using stable ids", async () => {
	const files = ["a", "b"].map((id) => ({
		id,
		group: id,
		name: "config.json",
		originalContent: "{}",
		content: "{}",
		handle: null,
		type: "json",
	})) as FileData[];
	jest.spyOn(StorageService, "loadFiles").mockResolvedValue(files);
	jest.spyOn(PermissionManager, "restoreSavedHandles").mockResolvedValue({
		restoredFiles: files,
		filesNeedingPermission: [],
	});
	jest.spyOn(StorageService, "autoRefreshFiles").mockResolvedValue(files);
	const loaded: FileData[] = [],
		render = jest.fn(),
		parse = jest.fn(async () => {});
	try {
		await loadPersistedWorkspace(loaded, parse, render);
		expect(loaded.map((file) => file.id)).toEqual(["a", "b"]);
		expect(render).toHaveBeenCalledTimes(1);
	} finally {
		jest.restoreAllMocks();
	}
});
