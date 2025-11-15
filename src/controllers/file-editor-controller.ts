import { FileData } from "../interfaces";
import { ParserFactory } from "../parsers";
import { FilePersistence } from "../persistence";
import { ModernFormRenderer } from "../ui/modern-form-renderer";
import { NotificationService } from "../ui/notifications";
import { findFormElementWithRetry } from "../ui/form-utils";
import { SchemaRegistry } from "../validation/schemaRegistry";
import initWasm from "../../parser-wasm/pkg/parser_core.js";
import * as ParserCore from "../../parser-wasm/pkg/parser_core.js";

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

type ValidationMetaInput = ValidationErrorDetail & {
        errors?: Array<SchemaValidationError | ValidationErrorDetail> | undefined;
};

type ValidationStateMeta = ValidationMetaInput & {
        valid: boolean;
        message?: string | undefined;
};

export class FileEditorController {
        private rawEditMode: Set<string> = new Set();
        private pendingRawAutosaveTimers: Map<string, number> = new Map();
        private pendingValidationTimers: Map<string, number> = new Map();
        private lastValidationMeta: Map<string, ValidationStateMeta> = new Map();
        private schemaCache: Map<string, string> = new Map();
        private wasmReady = false;
        private currentFiles: FileData[] = [];

        constructor(private options: FileEditorControllerOptions) {}

        public renderEditors(files: FileData[]): void {
                const container = document.getElementById("editorContainer");
                if (!container) return;

                this.currentFiles = files;
                container.innerHTML = "";

                files
                        .filter((fileData) => fileData.isActive !== false)
                        .forEach((fileData) => {
                                const editorElement = this.options.renderer.renderFileEditor(fileData);
                                container.appendChild(editorElement);

                                const rawBtn = editorElement.querySelector(
                                        ".toggle-raw-btn"
                                ) as HTMLButtonElement | null;
                                const isRaw = this.rawEditMode.has(fileData.id);
                                if (rawBtn) {
                                        const label = isRaw ? "Edit Values" : "Edit Raw";
                                        rawBtn.textContent = label;
                                        rawBtn.title = label;
                                        rawBtn.setAttribute("aria-label", label);
                                }

                                if (isRaw) {
                                        this.mountRawEditor(editorElement as HTMLElement, fileData);
                                        const meta = this.lastValidationMeta.get(fileData.id);
                                        if (meta && !meta.valid) {
                                                this.applyRawValidationDecorations(
                                                        fileData.id,
                                                        editorElement as HTMLElement,
                                                        meta
                                                );
                                        }
                                }
                        });
        }

        public toggleRawMode(fileId: string): void {
                if (this.rawEditMode.has(fileId)) this.rawEditMode.delete(fileId);
                else this.rawEditMode.add(fileId);
                this.renderEditors(this.currentFiles);
        }

        public requestValidation(
                fileId: string,
                mode: "raw" | "form",
                delay: number = 400
        ): void {
                this.scheduleValidation(fileId, mode, delay);
        }

        private applyRawValidationDecorations(
                fileId: string,
                editorElement: HTMLElement,
                meta: ValidationStateMeta
        ): void {
                const raw = editorElement.querySelector(
                        ".raw-editor"
                ) as HTMLDivElement | null;
                if (!raw) return;
                raw.classList.toggle("has-error", !meta.valid);
                raw.classList.toggle("is-valid", !!meta.valid);
                if (!meta.valid && meta.line && this.rawEditMode.has(fileId)) {
                        const text = raw.textContent || "";
                        const lines = text.split(/\n/);
                        const targetLine = Math.max(1, Math.min(lines.length, Math.floor(meta.line)));
                        const cs = window.getComputedStyle(raw);
                        const lh = parseFloat(cs.lineHeight || "0") || 18;
                        const paddingTop = parseFloat(cs.paddingTop || "0") || 8;
                        const targetTop = targetLine * lh - paddingTop - lh;
                        raw.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
                }
        }

        private mountRawEditor(editorElement: HTMLElement, fileData: FileData): void {
                const form = editorElement.querySelector("form");
                if (form && form.parentElement) {
                        form.parentElement.removeChild(form);
                }

                let raw = editorElement.querySelector(
                        ".raw-editor"
                ) as HTMLDivElement | null;
                if (!raw) {
                        raw = document.createElement("div");
                        raw.className = "raw-editor";
                        raw.setAttribute("data-id", fileData.id);
                        raw.setAttribute("contenteditable", "true");
                        raw.textContent = fileData.originalContent || "";

                        raw.addEventListener("input", () => {
                                this.scheduleRawAutosave(fileData.id);
                                this.scheduleValidation(fileData.id, "raw");
                        });
                        raw.addEventListener("blur", () => {
                                this.scheduleRawAutosave(fileData.id, 0);
                                this.scheduleValidation(fileData.id, "raw", 0);
                        });

                        const fieldsContainer = editorElement.querySelector(".form-fields");
                        if (fieldsContainer && fieldsContainer.parentElement) {
                                fieldsContainer.parentElement.appendChild(raw);
                        } else {
                                editorElement.appendChild(raw);
                        }
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
                content: string
        ): {
                valid: boolean;
                summary?: ValidationErrorDetail;
                errors: ValidationErrorDetail[];
        } {
                try {
                        const parser = ParserFactory.createParser(type, content);
                        parser.parse(content);
                        return { valid: true, errors: [] };
                } catch (error) {
                        const detail: ValidationErrorDetail = { message: "Invalid" };
                        if (error instanceof Error) {
                                detail.message = error.message;
                        }
                        return { valid: false, summary: detail, errors: [detail] };
                }
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
                const { validateWithId, validateInline, registerSchema } = ParserCore as unknown as {
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
                        const syntaxMeta = this.runSyntaxValidation(fileData.type, updated);
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
                const text = raw.textContent ?? "";
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

        private setValidationState(
                fileId: string,
                isValid: boolean,
                message?: string,
                details?: string[],
                meta?: ValidationMetaInput
        ): void {
                const editor = document.querySelector(
                        `div.file-editor[data-id="${fileId}"]`
                ) as HTMLElement | null;
                if (!editor) return;
                let badge = editor.querySelector(
                        ".validation-badge"
                ) as HTMLDivElement | null;
                if (!badge) {
                        badge = document.createElement("div");
                        badge.className = "validation-badge";
                        const header = editor.querySelector(".file-editor-header");
                        if (header && header.parentElement) {
                                header.parentElement.insertBefore(badge, header.nextSibling);
                        } else {
                                editor.insertBefore(badge, editor.firstChild);
                        }
                }
                badge.innerHTML = "";
                const icon = document.createElement("span");
                icon.className = "validation-badge__icon";
                const text = document.createElement("span");
                text.className = "validation-badge__text";
                text.textContent = isValid
                        ? "Valid"
                        : message
                        ? `Invalid (${message})`
                        : "Invalid";
                badge.appendChild(icon);
                badge.appendChild(text);
                if (!isValid) {
                        const parts: string[] = [];
                        if (meta?.line != null && meta?.column != null) {
                                parts.push(`Line ${meta.line}, Col ${meta.column}`);
                        }
                        if (details && details.length) {
                                parts.push(...details.slice(0, 5));
                        }
                        const extraErrors = meta?.errors?.slice(0, 3) ?? [];
                        if (extraErrors.length) {
                                extraErrors.forEach((err) => {
                                        const loc =
                                                err.line != null && err.column != null
                                                        ? ` (Line ${err.line}, Col ${err.column})`
                                                        : "";
                                        parts.push(`${err.message || "Invalid"}${loc}`);
                                });
                                if ((meta?.errors?.length || 0) > extraErrors.length) {
                                        parts.push(`View all (${meta?.errors?.length})`);
                                }
                        }
                        if (parts.length) badge.title = parts.join("\n");
                        else badge.removeAttribute("title");
                } else {
                        badge.removeAttribute("title");
                }
                badge.classList.toggle("is-valid", isValid);
                badge.classList.toggle("is-invalid", !isValid);

                const raw = editor.querySelector(".raw-editor") as HTMLDivElement | null;
                if (raw) {
                        raw.classList.toggle("has-error", !isValid);
                        raw.classList.toggle("is-valid", isValid);

                        if (!isValid && this.rawEditMode.has(fileId) && meta?.line) {
                                const text = raw.textContent || "";
                                const lines = text.split(/\n/);
                                const targetLine = Math.max(1, Math.min(lines.length, Math.floor(meta.line)));
                                const cs = window.getComputedStyle(raw);
                                const lh = parseFloat(cs.lineHeight || "0") || 18;
                                const paddingTop = parseFloat(cs.paddingTop || "0") || 8;
                                const targetTop = targetLine * lh - paddingTop - lh;
                                raw.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
                        }
                }

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

        private scheduleRawAutosave(fileId: string, delay: number = 600): void {
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
                const rawText = raw.textContent ?? "";

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
                        const message = error instanceof Error ? error.message : "Unknown error";
                        NotificationService.showError(`Failed to save raw: ${message}`);
                }
        }
}
