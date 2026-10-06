import { ConfirmationDialog } from "../../src/confirmation";
import { FileNotifications } from "../../src/ui/notifications";

describe("Untrusted filenames", () => {
	beforeEach(() => {
		document.body.innerHTML = '<div id="reconnectCards"></div>';
	});
	afterEach(() => {
		document.body.replaceChildren();
	});
	test("conflict messages display filenames as text", async () => {
		const name = "<img src=x onerror=alert(1)>.json";
		const pending = ConfirmationDialog.showFileConflictDialog(name);
		expect(
			document.querySelector(".file-conflict-dialog p")?.textContent
		).toContain(name);
		expect(
			document.querySelector(".file-conflict-dialog img[src=x]")
		).toBeNull();
		(document.querySelector(".cancel-btn") as HTMLButtonElement).click();
		await pending;
	});
	test("reconnect cards tolerate quotes and HTML in filenames", () => {
		const name = 'bad"] <img src=x onerror=alert(1)>.json';
		const handle = { name } as FileSystemFileHandle;
		FileNotifications.showReconnectCard(handle, () => {});
		FileNotifications.showReconnectCard(handle, () => {});
		expect(document.querySelectorAll(".reconnect-card")).toHaveLength(1);
		expect(
			document.querySelector(".reconnect-info")?.textContent
		).toContain(name);
		expect(document.querySelector(".reconnect-info img")).toBeNull();
	});
});
