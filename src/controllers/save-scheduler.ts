/** Debounce per-file saves and retain edits received while a write is pending. */
export class SaveScheduler {
	private timers = new Map<string, number>();
	private active = new Map<string, Promise<void>>();
	private queued = new Map<string, () => Promise<void>>();

	schedule(fileId: string, save: () => Promise<void>, delay = 600): void {
		const timer = this.timers.get(fileId);
		if (timer !== undefined) clearTimeout(timer);
		this.timers.set(
			fileId,
			window.setTimeout(() => {
				this.timers.delete(fileId);
				void this.run(fileId, save).catch((error: unknown) =>
					console.warn("Autosave failed", error)
				);
			}, delay)
		);
	}

	async run(fileId: string, save: () => Promise<void>): Promise<void> {
		const active = this.active.get(fileId);
		if (active) {
			this.queued.set(fileId, save);
			return active;
		}
		const operation = (async () => {
			let next: (() => Promise<void>) | undefined = save;
			while (next) {
				await next();
				next = this.queued.get(fileId);
				this.queued.delete(fileId);
			}
		})();
		this.active.set(fileId, operation);
		try {
			await operation;
		} finally {
			this.active.delete(fileId);
			this.queued.delete(fileId);
		}
	}
}
