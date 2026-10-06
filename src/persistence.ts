import { IPersistence, FileData } from "./interfaces";
import { ParserFactory } from "./parsers";
import { FileHandler } from "./fileHandler";
import { NotificationService } from "./ui/notifications";
import {
	SupportedFileType,
	getMimeTypeForFileType,
	getExtensionsForFileType,
} from "./utils/fileTypeUtils";

// Import WASM parser for non-destructive updates
import { ensureWasmInitialized } from "./wasm";
import { previewFormEdits } from "./ui/form-edits";
import { determineFileType } from "./utils/fileTypeUtils";

/**
 * Persistence Module
 * Handles saving form data back to files using WASM non-destructive updates
 * Follows Single Responsibility Principle and Dependency Inversion Principle
 */
export class FilePersistence implements IPersistence {
	private effectiveType(file: FileData, text: string): string {
		return file.type === "config"
			? determineFileType(file.name, text)
			: file.type;
	}
	async previewUpdatedContent(
		file: FileData,
		form: HTMLFormElement
	): Promise<string> {
		await ensureWasmInitialized();
		return previewFormEdits(
			this.effectiveType(file, file.originalContent),
			file.originalContent,
			form
		).content;
	}

	async saveRaw(file: FileData, text: string): Promise<void> {
		await ensureWasmInitialized();
		// Parse before writing, so invalid raw edits never reach disk.
		const parsed = ParserFactory.createParser(file.type, text).parse(text);
		if (text === file.originalContent) return;
		await this.writeContent(file, text);
		file.content = parsed;
		file.originalContent = text;
	}

	async saveFile(file: FileData, form: HTMLFormElement): Promise<void> {
		await ensureWasmInitialized();
		const draftContent = form.dataset.draftContent;
		const { content, values } = previewFormEdits(
			this.effectiveType(file, file.originalContent),
			file.originalContent,
			form
		);
		const parsed = ParserFactory.createParser(file.type, content).parse(
			content
		);
		if (content === file.originalContent) return;
		await this.writeContent(file, content);
		file.content = parsed;
		file.originalContent = content;
		// Record the saved snapshot, even if the user typed again during the write.
		for (const [input, value] of values)
			input.dataset.originalValue = value;
		if (form.dataset.draftContent === draftContent)
			delete form.dataset.draftContent;
	}

	private async writeContent(file: FileData, text: string): Promise<void> {
		try {
			if (file.handle)
				await new FileHandler().writeFile(file.handle, text);
			else await this.saveAsNewFile(file.name, text, file.type);
		} catch (error) {
			NotificationService.showError(
				`Failed to save ${file.name}: ${String(error)}`
			);
			throw error;
		}
	}
	/**
	 * Saves file with new handle when original handle is not available
	 */
	private async saveAsNewFile(
		originalName: string,
		content: string,
		fileType: SupportedFileType
	): Promise<void> {
		try {
			// Use showSaveFilePicker to let user choose save location
			const fileHandle = await window.showSaveFilePicker({
				suggestedName: originalName,
				types: [
					{
						description: `${fileType.toUpperCase()} files`,
						accept: {
							[getMimeTypeForFileType(fileType)]:
								getExtensionsForFileType(fileType),
						},
					},
				],
			});

			// Write content to the new file
			const writable = await fileHandle.createWritable();
			await writable.write(content);
			await writable.close();
		} catch (error) {
			if (error instanceof Error && error.name === "AbortError") {
				throw new Error("Save operation was cancelled");
			}
			throw error;
		}
	}
}
