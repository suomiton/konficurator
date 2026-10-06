import { SaveScheduler } from "../../src/controllers/save-scheduler";

describe("SaveScheduler", () => {
	beforeEach(() => jest.useFakeTimers());
	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
	});
	test("debounces independently by stable file id", async () => {
		const scheduler = new SaveScheduler(),
			save = jest.fn(async () => {}),
			other = jest.fn(async () => {});
		scheduler.schedule("one", save, 20);
		scheduler.schedule("one", save, 20);
		scheduler.schedule("two", other, 20);
		await jest.advanceTimersByTimeAsync(20);
		expect(save).toHaveBeenCalledTimes(1);
		expect(other).toHaveBeenCalledTimes(1);
	});
	test("saves the newest queued edit after the current write finishes", async () => {
		const scheduler = new SaveScheduler();
		let complete!: () => void;
		const first = jest.fn(
			() =>
				new Promise<void>((resolve) => {
					complete = resolve;
				})
		);
		const obsolete = jest.fn(async () => {}),
			latest = jest.fn(async () => {});
		const pending = scheduler.run("one", first);
		void scheduler.run("one", obsolete);
		void scheduler.run("one", latest);
		complete();
		await pending;
		expect(obsolete).not.toHaveBeenCalled();
		expect(latest).toHaveBeenCalledTimes(1);
	});
});
