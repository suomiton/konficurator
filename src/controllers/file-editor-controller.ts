import { FileData } from "../interfaces";
import { ParserFactory } from "../parsers";
import { FilePersistence } from "../persistence";
import { ModernFormRenderer } from "../ui/modern-form-renderer";
import { findFormElementWithRetry } from "../ui/form-utils";
import { SchemaRegistry } from "../validation/schemaRegistry";
import initWasm from "../../parser-wasm/pkg/parser_core.js";
import * as ParserCore from "../../parser-wasm/pkg/parser_core.js";
import { determineFileType } from "../utils/fileTypeUtils";

export interface FileEditorControllerOptions {
	renderer: ModernFormRenderer;
	persistence: FilePersistence;
	getFiles(): FileData[];
	saveToStorage(): Promise<void>;
}

type SchemaValidationError = {
	message: string;
	keyword?: string;
	instancePath: string;
	schemaPath?: string;
	line?: number;
	column?: number;
	start?: number;
	end?: number;
};

type SchemaValidationResult = {
	valid: boolean;
	errors?: SchemaValidationError[];
};

type ValidationErrorDetail = {
	message?: string | undefined;
	code?: string | undefined;
	line?: number | undefined;
	column?: number | undefined;
	start?: number | undefined;
	end?: number | undefined;
};

export type ValidationMetaInput = ValidationErrorDetail & {
	errors?: Array<SchemaValidationError | ValidationErrorDetail> | undefined;
};

type ValidationStateMeta = ValidationMetaInput & {
	valid: boolean;
	message?: string | undefined;
};

export class FileEditorController {
	private pendingRawAutosaveTimers: Map<string, number> = new Map();
	private pendingValidationTimers: Map<string, number> = new Map();
	private lastValidationMeta: Map<string, ValidationStateMeta> = new Map();
	private schemaCache: Map<string, string> = new Map();
	private wasmReady = false;
	// currentFiles no longer tracked here; renderer manages view state

	constructor(private options: FileEditorControllerOptions) {}

	public renderEditors(files: FileData[]): void {
		const container = document.getElementById("editorContainer");
		if (!container) return;

		// renderer handles view state; no need to track files here
		container.innerHTML = "";

		files
			.filter((fileData) => fileData.isActive !== false)
			.forEach((fileData) => {
				const editorElement = this.options.renderer.renderFileEditor(fileData);
				container.appendChild(editorElement);
			});
	}

	public requestValidation(
		fileId: string,
		mode: "raw" | "form",
		delay: number = 400
	): void {
		// Immediate provisional ENV scan (raw mode) to show structural errors fast
		if (mode === "raw") {
			const fileData = this.options.getFiles().find((f) => f.id === fileId);
			if (
				fileData &&
				(fileData.type === "env" ||
					(fileData.type === "config" &&
						determineFileType(fileData.name, fileData.originalContent) ===
							"env"))
			) {
				const editor = document.querySelector(
					`div.file-editor[data-id="${fileId}"] .raw-editor`
				) as HTMLDivElement | null;
				if (editor) {
					// Collect lines explicitly from raw-line children to avoid reliance on innerText (jsdom)
					const lineEls = editor.querySelectorAll(".raw-line");
					const lines = Array.from(lineEls).map((el) => el.textContent || "");
					const provisionalErrors: Array<{
						message?: string;
						line?: number;
						column?: number;
					}> = [];
					lines.forEach((line: string, idx: number) => {
						const trimmed = line.trim();
						if (!trimmed || trimmed.startsWith("#")) return;
						if (!trimmed.includes("=")) {
							provisionalErrors.push({
								message: "Missing '=' separator",
								line: idx + 1,
								column: 1,
							});
						}
					});
					if (provisionalErrors.length) {
						const first = provisionalErrors[0];
						this.options.renderer.applyRawValidation(fileId, {
							valid: false,
							errors: provisionalErrors,
							message: first.message || "Invalid",
							line: first.line || 1,
						});
					}
				}
			}
		}
		this.scheduleValidation(fileId, mode, delay);
	}

	private applyRawValidationDecorations(
		fileId: string,
		editorElement: HTMLElement,
		meta?: ValidationStateMeta
	): void {
		// Delegate overlay rendering to renderer-managed RawEditor instance
		const payload = meta
			? {
					valid: meta.valid,
					message: meta.message,
					line: meta.line,
					errors: (meta.errors || []).map((e) => ({
						message: (e as any)?.message,
						line: (e as any)?.line,
						column: (e as any)?.column,
					})),
			  }
			: undefined;
		// If we have no errors array but meta invalid, push summary for overlay visibility
		if (
			payload &&
			payload.valid === false &&
			(!payload.errors || !payload.errors.length) &&
			meta &&
			meta.line
		) {
			payload.errors = [
				{ message: meta.message, line: meta.line, column: meta.column },
			];
		}
		this.options.renderer.applyRawValidation(fileId, payload as any);

		// If raw editor is present (i.e., in raw mode), perform gentle scroll to error line
		const raw = editorElement.querySelector(
			".raw-editor"
		) as HTMLDivElement | null;
		if (raw && meta && meta.valid === false && meta.line) {
			const text = (raw as any).innerText ?? raw.textContent ?? "";
			const lines = text.split(/\n/);
			const targetLine = Math.max(
				1,
				Math.min(lines.length, Math.floor(meta.line))
			);
			const cs = window.getComputedStyle(raw);
			const lh = parseFloat(cs.lineHeight || "0") || 18;
			const paddingTop = parseFloat(cs.paddingTop || "0") || 8;
			const targetTop = targetLine * lh - paddingTop - lh;
			raw.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
		}
	}

	/** Reapply stored validation meta to raw view (used when toggling into raw) */
	public reapplyLastDecorations(fileId: string): void {
		const meta = this.lastValidationMeta.get(fileId);
		const editor = document.querySelector(
			`div.file-editor[data-id="${fileId}"]`
		) as HTMLElement | null;
		if (!editor) return;
		if (meta) {
			this.applyRawValidationDecorations(fileId, editor, meta);
		}
	}

	private scheduleValidation(
		fileId: string,
		mode: "raw" | "form",
		delay: number = 400
	): void {
		const key = `${mode}:${fileId}`;
		const existing = this.pendingValidationTimers.get(key);
		if (existing) clearTimeout(existing);
		const timer = window.setTimeout(async () => {
			this.pendingValidationTimers.delete(key);
			try {
				if (mode === "raw") await this.handleValidateRaw(fileId);
				else await this.handleValidateForm(fileId);
			} catch (e) {
				console.warn("Validation failed", e);
			}
		}, delay);
		this.pendingValidationTimers.set(key, timer);
	}

	private runSyntaxValidation(
		type: FileData["type"],
		content: string,
		fileName?: string
	): {
		valid: boolean;
		summary?: ValidationErrorDetail;
		errors: ValidationErrorDetail[];
	} {
		// Prefer WASM multi-error validation when available & initialized
		const validateMulti = (
			ParserCore as unknown as {
				validate_multi?: (
					fileType: string,
					content: string,
					maxErrors?: number
				) => {
					valid: boolean;
					errors: Array<{
						message: string;
						code?: string;
						line: number;
						column: number;
						start: number;
						end: number;
					}>;
					summary?: {
						message: string;
						line: number;
						column: number;
						start: number;
						end: number;
					};
				};
			}
		).validate_multi;

		// Adapt .config file types dynamically so ENV/JSON formats are validated correctly
		const effectiveType =
			type === "config"
				? determineFileType(fileName || "dummy.config", content)
				: type;
		let baseValid = true;
		let baseErrors: ValidationErrorDetail[] = [];
		let baseSummary: ValidationErrorDetail | undefined;
		try {
			if (validateMulti) {
				const wasmResult = validateMulti(effectiveType, content, 50);
				if (!wasmResult.valid) {
					baseValid = false;
					baseErrors = wasmResult.errors.map((e) => ({
						message: e.message,
						code: e.code,
						line: e.line,
						column: e.column,
						start: e.start,
						end: e.end,
					}));
					baseSummary = wasmResult.summary
						? {
								message: wasmResult.summary.message,
								line: wasmResult.summary.line,
								column: wasmResult.summary.column,
								start: wasmResult.summary.start,
								end: wasmResult.summary.end,
						  }
						: baseErrors[0];
				}
				// If valid we leave errors empty for now; potential ENV augmentation below.
			} else {
				// Fallback parser
				const parser = ParserFactory.createParser(effectiveType, content);
				parser.parse(content);
			}
		} catch (error) {
			baseValid = false;
			const detail: ValidationErrorDetail = { message: "Invalid" };
			if (error instanceof Error) detail.message = error.message;
			baseErrors = [detail];
			baseSummary = detail;
		}

		// ENV augmentation: identify non-comment, non-empty lines without '='
		if (effectiveType === "env") {
			// Accept only printable ASCII + standard control chars; trim any CR characters
			const normalized = content.replace(/\r\n?/g, "\n");
			// Strip non-breaking spaces and other non-ASCII bytes (defensive)
			const cleaned = normalized.replace(/[\u00A0\u2000-\u200F]/g, "");
			const envLines = cleaned.split(/\n/);
			const augmented: ValidationErrorDetail[] = [];
			envLines.forEach((line, idx) => {
				const trimmed = line.trim();
				if (!trimmed || trimmed.startsWith("#")) return;
				if (!trimmed.includes("=")) {
					augmented.push({
						message: "Missing '=' separator",
						line: idx + 1,
						column: 1,
						start: 0,
						end: 0,
					});
				}
			});
			if (augmented.length) {
				baseErrors = baseErrors.concat(augmented);
				baseValid = false; // mark invalid if any env structural errors
				if (!baseSummary) baseSummary = augmented[0];
			}
		}

		const result: {
			valid: boolean;
			summary?: ValidationErrorDetail;
			errors: ValidationErrorDetail[];
		} = {
			valid: baseValid,
			errors: baseErrors,
		};
		if (baseSummary) result.summary = baseSummary;
		return result;
	}

	private async runSchemaValidation(
		fileData: FileData,
		content: string
	): Promise<SchemaValidationResult | null> {
		const schemaMatch = SchemaRegistry.getForFile(fileData);
		if (!schemaMatch) {
			return null;
		}

		const wrapError = (error: unknown): SchemaValidationResult => ({
			valid: false,
			errors: [
				{
					message: error instanceof Error ? error.message : String(error),
					instancePath: "",
				},
			],
		});

		const serializedSchema = (() => {
			try {
				return JSON.stringify(schemaMatch.schema);
			} catch (error) {
				console.warn("Failed to serialize schema", error);
				return null;
			}
		})();
		if (!serializedSchema) {
			return wrapError(new Error("Schema serialization failed"));
		}

		const wasmOptions = { maxErrors: 50, collectPositions: true };
		const { validateWithId, validateInline, registerSchema } =
			ParserCore as unknown as {
				validateWithId?: (
					data: string,
					schemaId: string,
					options: { maxErrors: number; collectPositions: boolean }
				) => SchemaValidationResult;
				validateInline?: (
					data: string,
					schema: string,
					options: { maxErrors: number; collectPositions: boolean }
				) => SchemaValidationResult;
				registerSchema?: (schemaId: string, schema: string) => void;
			};

		if (validateWithId && registerSchema) {
			const cached = this.schemaCache.get(schemaMatch.key);
			if (cached !== serializedSchema) {
				try {
					registerSchema(schemaMatch.key, serializedSchema);
					this.schemaCache.set(schemaMatch.key, serializedSchema);
				} catch (error) {
					console.warn(
						`Schema registration failed for ${schemaMatch.key}`,
						error
					);
					return wrapError(error);
				}
			}
			try {
				return validateWithId(content, schemaMatch.key, wasmOptions);
			} catch (error) {
				console.warn(`Schema validation failed for ${schemaMatch.key}`, error);
				return wrapError(error);
			}
		}

		if (validateInline) {
			try {
				return validateInline(content, serializedSchema, wasmOptions);
			} catch (error) {
				console.warn("Schema validation failed", error);
				return wrapError(error);
			}
		}

		return null;
	}

	private applySchemaValidationState(
		fileId: string,
		result: SchemaValidationResult
	): void {
		const first = result.errors?.[0];
		this.setValidationState(
			fileId,
			result.valid,
			first?.message || "Schema validation failed",
			undefined,
			{
				line: first?.line,
				column: first?.column,
				start: first?.start,
				end: first?.end,
				errors: result.errors,
			}
		);
	}

	private async handleValidateForm(fileId: string): Promise<void> {
		const fileData = this.options.getFiles().find((f) => f.id === fileId);
		if (!fileData) return;
		const form = await findFormElementWithRetry(fileId);
		if (!form) return;
		try {
			if (!this.wasmReady) {
				await initWasm();
				this.wasmReady = true;
			}
			const updated = await this.options.persistence.previewUpdatedContent(
				fileData,
				form
			);
			const syntaxMeta = this.runSyntaxValidation(
				fileData.type,
				updated,
				fileData.name
			);
			if (!syntaxMeta.valid) {
				const primary = syntaxMeta.summary ?? syntaxMeta.errors[0];
				this.setValidationState(
					fileId,
					false,
					primary?.message || "Invalid",
					undefined,
					{
						line: primary?.line,
						column: primary?.column,
						start: primary?.start,
						end: primary?.end,
						errors: syntaxMeta.errors,
					}
				);
				return;
			}
			const schemaResult = await this.runSchemaValidation(fileData, updated);
			if (schemaResult && !schemaResult.valid) {
				this.applySchemaValidationState(fileId, schemaResult);
				return;
			}
			const parser = ParserFactory.createParser(fileData.type, updated);
			parser.parse(updated);
			this.setValidationState(fileId, true);
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			this.setValidationState(fileId, false, msg);
		}
	}

	private async handleValidateRaw(fileId: string): Promise<void> {
		const fileData = this.options.getFiles().find((f) => f.id === fileId);
		if (!fileData) return;
		const editor = document.querySelector(
			`div.file-editor[data-id="${fileId}"]`
		) as HTMLElement | null;
		if (!editor) return;
		const raw = editor.querySelector(".raw-editor") as HTMLDivElement | null;
		if (!raw) return;
		// Build content from raw-line children to preserve line breaks in jsdom
		const text = Array.from(raw.querySelectorAll(".raw-line"))
			.map((el) => el.textContent || "")
			.join("\n");
		try {
			if (!this.wasmReady) {
				await initWasm();
				this.wasmReady = true;
			}
			const syntaxMeta = this.runSyntaxValidation(fileData.type, text);
			if (!syntaxMeta.valid) {
				const primary = syntaxMeta.summary ?? syntaxMeta.errors[0];
				this.setValidationState(
					fileId,
					false,
					primary?.message || "Invalid",
					undefined,
					{
						line: primary?.line,
						column: primary?.column,
						start: primary?.start,
						end: primary?.end,
						errors: syntaxMeta.errors,
					}
				);
				return;
			}
			const schemaResult = await this.runSchemaValidation(fileData, text);
			if (schemaResult && !schemaResult.valid) {
				this.applySchemaValidationState(fileId, schemaResult);
				return;
			}
			const parser = ParserFactory.createParser(fileData.type, text);
			parser.parse(text);
			this.setValidationState(fileId, true);
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			this.setValidationState(fileId, false, msg);
		}
	}

	public applyValidationState(
		fileId: string,
		isValid: boolean,
		message?: string,
		details?: string[],
		meta?: ValidationMetaInput
	): void {
		this.setValidationState(fileId, isValid, message, details, meta);
	}

	private setValidationState(
		fileId: string,
		isValid: boolean,
		message?: string,
		_details?: string[],
		meta?: ValidationMetaInput
	): void {
		const editor = document.querySelector(
			`div.file-editor[data-id="${fileId}"]`
		) as HTMLElement | null;
		if (!editor) return;

		const stateMeta: ValidationStateMeta = {
			valid: isValid,
			message,
			line: meta?.line,
			column: meta?.column,
			start: meta?.start,
			end: meta?.end,
			errors: meta?.errors,
		};
		this.applyRawValidationDecorations(fileId, editor, stateMeta);

		this.lastValidationMeta.set(fileId, {
			valid: isValid,
			message,
			line: meta?.line,
			column: meta?.column,
			start: meta?.start,
			end: meta?.end,
			errors: meta?.errors,
		});
	}

	public scheduleRawAutosave(fileId: string, delay: number = 600): void {
		const existing = this.pendingRawAutosaveTimers.get(fileId);
		if (existing) clearTimeout(existing);
		const timer = window.setTimeout(async () => {
			this.pendingRawAutosaveTimers.delete(fileId);
			try {
				await this.handleRawSave(fileId);
			} catch (e) {
				console.warn("Raw autosave failed", e);
			}
		}, delay);
		this.pendingRawAutosaveTimers.set(fileId, timer);
	}

	private async handleRawSave(fileId: string): Promise<void> {
		const fileData = this.options.getFiles().find((f) => f.id === fileId);
		if (!fileData) return;
		const editorElement = document.querySelector(
			`div.file-editor[data-id="${fileId}"]`
		) as HTMLElement | null;
		if (!editorElement) return;
		const raw = editorElement.querySelector(
			".raw-editor"
		) as HTMLDivElement | null;
		if (!raw) return;
		const rawText = (raw as any).innerText ?? raw.textContent ?? "";

		try {
			await this.options.persistence.saveRaw(fileData, rawText);
			if (fileData.handle) {
				try {
					const f = await fileData.handle.getFile();
					fileData.lastModified = f.lastModified;
				} catch {}
			}
			await this.options.saveToStorage();
		} catch (error) {
			// Suppress toast for raw editor saves; log only
			const message = error instanceof Error ? error.message : "Unknown error";
			console.warn(`Raw save failed (non-blocking): ${message}`);
		}
	}
}
