import { SaveScheduler } from "./save-scheduler";
import { FileData } from "../interfaces";
import { FilePersistence } from "../persistence";
import { ModernFormRenderer } from "../ui/modern-form-renderer";
import { SchemaRegistry } from "../validation/schemaRegistry";
import { ensureWasmInitialized } from "../wasm";
import {
	validate_multi,
	register_schema,
	validate_schema_with_id,
} from "../../parser-wasm/pkg/parser_core.js";
import { determineFileType } from "../utils/fileTypeUtils";
import { RawErrorMeta, RawErrorEntry } from "../ui/raw-error-overlay";

export interface FileEditorControllerOptions {
	renderer: ModernFormRenderer;
	persistence: FilePersistence;
	getFiles(): FileData[];
	saveToStorage(): Promise<void>;
	saveScheduler?: SaveScheduler;
}
export type ValidationMetaInput = RawErrorEntry & {
	errors?: RawErrorEntry[] | undefined;
};

export class FileEditorController {
	private timers = new Map<string, number>();
	private lastValidationMeta = new Map<string, RawErrorMeta>();
	private schemaCache = new Map<string, string>();
	private saveScheduler: SaveScheduler;
	constructor(private options: FileEditorControllerOptions) {
		this.saveScheduler = options.saveScheduler ?? new SaveScheduler();
	}

	renderEditors(files: FileData[]): void {
		const container = document.getElementById("editorContainer");
		if (!container) return;
		container.replaceChildren(
			...files
				.filter((file) => file.isActive !== false)
				.map((file) => this.options.renderer.renderFileEditor(file))
		);
	}

	requestValidation(fileId: string, mode: "raw" | "form", delay = 400): void {
		this.schedule(`${mode}:${fileId}`, delay, async () => {
			const file = this.options.getFiles().find((f) => f.id === fileId);
			if (!file) return;
			const form = this.options.renderer.getForm(fileId);
			const text =
				mode === "raw"
					? this.options.renderer.getRawContent(fileId)
					: form
						? await this.options.persistence.previewUpdatedContent(
								file,
								form
							)
						: undefined;
			if (text !== undefined) await this.validateText(file, text);
		});
	}

	private schedule(
		key: string,
		delay: number,
		action: () => Promise<void>
	): void {
		const existing = this.timers.get(key);
		if (existing !== undefined) clearTimeout(existing);
		this.timers.set(
			key,
			window.setTimeout(async () => {
				this.timers.delete(key);
				try {
					await action();
				} catch (error) {
					this.applyValidationState(
						key.split(":").slice(1).join(":"),
						false,
						String(error)
					);
				}
			}, delay)
		);
	}

	private async validateText(file: FileData, text: string): Promise<boolean> {
		await ensureWasmInitialized();
		const type =
			file.type === "config"
				? determineFileType(file.name, text)
				: file.type;
		const syntax = validate_multi(type, text, 50);
		if (!syntax.valid) {
			const first = syntax.summary ?? syntax.errors[0];
			this.applyValidationState(
				file.id,
				false,
				first?.message,
				undefined,
				{ ...first, errors: syntax.errors }
			);
			return false;
		}
		const match = SchemaRegistry.getForFile(file);
		if (match && type === "json") {
			const serialized = JSON.stringify(match.schema);
			if (this.schemaCache.get(match.key) !== serialized) {
				register_schema(match.key, serialized);
				this.schemaCache.set(match.key, serialized);
			}
			const result = validate_schema_with_id(text, match.key, {
				maxErrors: 50,
				collectPositions: true,
			});
			if (!result.valid) {
				const errors: RawErrorEntry[] = result.errors.map((error) => ({
					message: error.message,
					line: error.line ?? undefined,
					column: error.column ?? undefined,
					start: error.start ?? undefined,
					end: error.end ?? undefined,
				}));
				this.applyValidationState(
					file.id,
					false,
					errors[0]?.message,
					undefined,
					{ ...errors[0], errors }
				);
				return false;
			}
		}
		this.applyValidationState(file.id, true);
		return true;
	}

	applyValidationState(
		fileId: string,
		valid: boolean,
		message?: string,
		_details?: string[],
		meta?: ValidationMetaInput
	): void {
		const state: RawErrorMeta = { valid, message, ...meta };
		this.lastValidationMeta.set(fileId, state);
		this.options.renderer.applyRawValidation(fileId, state);
	}
	reapplyLastDecorations(fileId: string): void {
		this.options.renderer.applyRawValidation(
			fileId,
			this.lastValidationMeta.get(fileId)
		);
	}
	scheduleRawAutosave(fileId: string, delay = 600): void {
		this.saveScheduler.schedule(
			fileId,
			() => this.handleRawSave(fileId),
			delay
		);
	}
	private async handleRawSave(fileId: string): Promise<void> {
		const file = this.options.getFiles().find((f) => f.id === fileId);
		const text = this.options.renderer.getRawContent(fileId);
		if (!file || text === undefined) return;
		if (!(await this.validateText(file, text))) return;
		if (this.options.renderer.getRawContent(fileId) !== text) return;
		await this.options.persistence.saveRaw(file, text);
		if (file.handle)
			file.lastModified = (await file.handle.getFile()).lastModified;
		await this.options.saveToStorage();
	}
}
