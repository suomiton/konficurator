import { jest } from "@jest/globals";
import { KonficuratorApp } from "../../src/main";

describe("KonficuratorApp autosave", () => {
	beforeEach(() => {
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
		jest.restoreAllMocks();
	});

	test("debounces multiple scheduleAutosave calls into one save per file", async () => {
		const app = new KonficuratorApp();
		const saveSpy = jest
			.spyOn(app as any, "handleFileSave")
			.mockResolvedValue(undefined);

		(app as any).loadedFiles = [];

		(app as any).scheduleAutosave("file-1", 600);
		(app as any).scheduleAutosave("file-1", 600);
		(app as any).scheduleAutosave("file-1", 600);

		jest.advanceTimersByTime(600);

		expect(saveSpy).toHaveBeenCalledTimes(1);
		expect(saveSpy).toHaveBeenCalledWith("file-1");
	});

	test("independent debouncing per file id", async () => {
		const app = new KonficuratorApp();
		const saveSpy = jest
			.spyOn(app as any, "handleFileSave")
			.mockResolvedValue(undefined);

		(app as any).scheduleAutosave("file-A", 300);
		(app as any).scheduleAutosave("file-B", 300);

		jest.advanceTimersByTime(300);

		expect(saveSpy).toHaveBeenCalledTimes(2);
		expect(saveSpy).toHaveBeenNthCalledWith(1, "file-A");
		expect(saveSpy).toHaveBeenNthCalledWith(2, "file-B");
	});
});
