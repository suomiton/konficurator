/**
 * Persistent storage for Konficurator using IndexedDB.
 * ---------------------------------------------------
 * Single object-store design – keeps both the file *metadata* and the
 * (optional) FileSystemFileHandle in one record, so we avoid dual-store
 * coordination and stick to the Single Responsibility Principle.
 *
 * All IDB operations are wrapped in small helpers to keep the public API
 * (save / load / remove / clear) concise.
 *
 * NOTE: FileSystemFileHandle survives serialisation but the **permission**
 * does not.  On page-load we therefore run `queryPermission()` silently; if it
 * returns anything other than "granted" the UI layer must ask the user via a
 * click-triggered `requestPermission()`.
 */

import { FileData } from "./interfaces";
import { GroupAccentId, normalizeGroupAccent } from "./theme/groupColors";

export interface StoredFileV2 {
        id: string;
        name: string;
        group: string;
        groupColor?: GroupAccentId | string;
	type: "json" | "xml" | "config" | "env";
	lastModified: number;
	content: string;
	size: number;
	handle?: FileSystemFileHandle | undefined;
	path?: string | undefined;
	isActive?: boolean | undefined;
}

export class StorageService {
	// Dev reset: bump version to wipe old data; we intentionally recreate the store.
	private static readonly DB_NAME = "konficurator_db";
	private static readonly DB_VERSION = 2;
	private static readonly STORE = "files_v2";

	/* ────────────────────────────────────────────────────────────────── */
	/*  Low-level helpers                                                */
	/* ────────────────────────────────────────────────────────────────── */

	/** Open (or create) the database.  Always returns the same instance. */
	private static async db(): Promise<IDBDatabase> {
		return new Promise((resolve, reject) => {
			const req = indexedDB.open(this.DB_NAME, this.DB_VERSION);

			req.onupgradeneeded = () => {
				const db = req.result;
				// Drop legacy stores if present (development reset scenario)
				for (let i = 0; i < db.objectStoreNames.length; i++) {
					const name = db.objectStoreNames.item(i);
					if (name && name !== this.STORE) {
						db.deleteObjectStore(name);
					}
				}
				if (!db.objectStoreNames.contains(this.STORE)) {
					db.createObjectStore(this.STORE, { keyPath: "id" });
				}
			};

			req.onsuccess = () => resolve(req.result);
			req.onerror = () => reject(req.error);
		});
	}

	/** Wrap a transaction into a promise that resolves on `complete`. */
	private static awaitTx(tx: IDBTransaction): Promise<void> {
		return new Promise((res, rej) => {
			tx.oncomplete = () => res();
			tx.onerror = () => rej(tx.error);
			tx.onabort = () => rej(tx.error);
		});
	}

	/* ────────────────────────────────────────────────────────────────── */
	/*  Public API                                                       */
	/* ────────────────────────────────────────────────────────────────── */

	/** Persist (or update) a list of files – metadata + optional handle. */
	static async saveFiles(files: FileData[]): Promise<void> {
		const db = await this.db();
		const tx = db.transaction(this.STORE, "readwrite");
		const store = tx.objectStore(this.STORE);

		for (const f of files) {
			const record: StoredFileV2 = {
				id: f.id,
				name: f.name,
				group: f.group,
				type: f.type,
				lastModified: f.lastModified ?? Date.now(),
				content: f.originalContent,
				size: f.size ?? f.originalContent.length,
				isActive: f.isActive,
			} as StoredFileV2;

			if (f.groupColor !== undefined) {
				(record as any).groupColor = f.groupColor;
			}
			if (f.handle !== null && f.handle !== undefined) {
				(record as any).handle = f.handle;
			}
			if (f.path !== undefined) {
				(record as any).path = f.path;
			}

			store.put(record);
		}

		await this.awaitTx(tx);
	}

	/** Load every stored file; tries to reuse handles if permission granted. */
	static async loadFiles(): Promise<FileData[]> {
		const db = await this.db();
		const tx = db.transaction(this.STORE, "readonly");
		const store = tx.objectStore(this.STORE);

		const records: StoredFileV2[] = await new Promise((res, rej) => {
			const req = store.getAll();
			req.onsuccess = () => res(req.result as StoredFileV2[]);
			req.onerror = () => rej(req.error);
		});

		await this.awaitTx(tx);

		const result: FileData[] = [];

		for (const r of records) {
			let actualType = r.type;
			if (r.type === "config" && r.content) {
				try {
					JSON.parse(r.content.trim());
					actualType = "json";
				} catch {
					const trimmed = r.content.trim();
					if (trimmed.startsWith("<?xml") || trimmed.startsWith("<")) {
						actualType = "xml";
					}
				}
			}

			const fd: FileData = {
				id: r.id,
				name: r.name,
				group: r.group,
				type: actualType,
				content: r.content,
				originalContent: r.content,
				lastModified: r.lastModified,
				size: r.size,
				handle: null,
				isActive: r.isActive !== undefined ? r.isActive : true,
			} as FileData;

                        if (r.groupColor !== undefined) {
                                const accent = normalizeGroupAccent(r.groupColor);
                                if (accent) (fd as any).groupColor = accent;
                        }
			if (r.path) fd.path = r.path;

			if (r.handle) {
				try {
					const qp = await (r.handle as any).queryPermission?.({
						mode: "readwrite",
					});
					if (qp === "granted") {
						fd.handle = r.handle;
					} else {
						fd.handle = r.handle;
						fd.permissionDenied = true;
					}
				} catch {
					/* ignore */
				}
			}

			result.push(fd);
		}

		return result;
	}

	/** Remove a single file entry. */
	static async removeFile(id: string): Promise<void> {
		const db = await this.db();
		const tx = db.transaction(this.STORE, "readwrite");
		tx.objectStore(this.STORE).delete(id);
		await this.awaitTx(tx);
	}

	/** Clear the entire store. */
	static async clearAll(): Promise<void> {
		const db = await this.db();
		const tx = db.transaction(this.STORE, "readwrite");
		tx.objectStore(this.STORE).clear();
		await this.awaitTx(tx);
		localStorage.removeItem("konficurator_files"); // legacy cleanup
	}

	/** Auto-refresh files that still have a valid handle. */
	static async autoRefreshFiles(files: FileData[]): Promise<FileData[]> {
		const out: FileData[] = [];

		for (const f of files) {
			if (!f.handle) {
				// No handle available, cannot refresh
				out.push(f);
				continue;
			}

			try {
				const refreshedFile = await this.autoRefreshFile(f);
				out.push(refreshedFile);
			} catch (error) {
				console.warn(`Failed to refresh file ${f.name}:`, error);
				out.push(f); // Keep original file if refresh fails
			}
		}

		return out;
	}

	static async autoRefreshFile(file: FileData): Promise<FileData> {
		if (!file.handle) {
			return { ...file, autoRefreshed: false };
		}

		try {
			const perm = await (file.handle as any).queryPermission?.({
				mode: "readwrite",
			});
			if (perm === "denied") {
				return { ...file, permissionDenied: true, autoRefreshed: false };
			}
			const blob = await file.handle.getFile();
			const text = await blob.text();
			const changed = blob.lastModified !== file.lastModified;
			return {
				...file,
				content: changed ? text : file.content,
				originalContent: changed ? text : file.originalContent,
				lastModified: blob.lastModified,
				size: blob.size,
				autoRefreshed: changed,
				permissionDenied: false,
			};
		} catch {
			return { ...file, permissionDenied: true, autoRefreshed: false };
		}
	}
}
