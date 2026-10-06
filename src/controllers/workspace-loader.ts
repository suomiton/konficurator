import { FileData } from "../interfaces";
import { StorageService } from "../handleStorage";
import { PermissionManager } from "../permissionManager";
import { NotificationService } from "../ui/notifications";
import { createIconLabel, createIconList, IconListItem } from "../ui/icon";

/** Restore session records by stable id, including same-named files in different groups. */
export async function loadPersistedWorkspace(
	files: FileData[],
	processFile: (file: FileData) => Promise<void>,
	render: () => void
): Promise<void> {
	try {
		const restoredFiles = await StorageService.loadFiles();
		if (!restoredFiles.length) {
			NotificationService.showInfo(
				createIconLabel(
					"help-circle",
					'No saved files found. Use the "Add" button to load configuration files from your computer.',
					{ size: 18 }
				)
			);
			return;
		}

		NotificationService.showLoading(
			`Loading ${restoredFiles.length} persisted file(s)...`
		);

		const { restoredFiles: processedFiles, filesNeedingPermission } =
			await PermissionManager.restoreSavedHandles(restoredFiles);
		const refreshedFiles =
			await StorageService.autoRefreshFiles(processedFiles);

		let autoRefreshedCount = 0;
		let permissionDeniedCount = 0;
		let grantedFiles = 0;

		for (const fileData of refreshedFiles) {
			await processFile(fileData);
			if (fileData.isActive === undefined) {
				fileData.isActive = true;
			}
			if (fileData.autoRefreshed) autoRefreshedCount++;
			if (fileData.permissionDenied) permissionDeniedCount++;
			if (fileData.handle && !fileData.permissionDenied) grantedFiles++;

			const existingIndex = files.findIndex((f) => f.id === fileData.id);
			if (existingIndex >= 0) files[existingIndex] = fileData;
			else files.push(fileData);
		}

		render();
		NotificationService.hideLoading();

		if (filesNeedingPermission.length > 0) {
			NotificationService.showWarning(
				createIconLabel(
					"alert-triangle",
					`${filesNeedingPermission.length} file(s) need permission to access. Please grant access using the cards above.`,
					{ size: 18 }
				)
			);
		}

		const fileNames = refreshedFiles.map((f) => f.name).join(", ");
		const messageItems: IconListItem[] = [
			{
				icon: "folder",
				text: `Restored ${refreshedFiles.length} file(s): ${fileNames}`,
			},
		];
		if (grantedFiles > 0) {
			messageItems.push({
				icon: "check-circle",
				text: `${grantedFiles} file(s) have disk access`,
			});
		}
		if (autoRefreshedCount > 0) {
			messageItems.push({
				icon: "refresh-cw",
				text: `Auto-refreshed ${autoRefreshedCount} file(s) from disk`,
			});
		}
		if (
			permissionDeniedCount === 0 &&
			filesNeedingPermission.length === 0
		) {
			NotificationService.showInfo(
				createIconList(messageItems, { size: 18 })
			);
		}
	} catch (error) {
		console.warn("Failed to load persisted files:", error);
	}
}
