/** Blob.text() consumes a UTF-8 BOM. Keep it in the editing baseline instead. */
export async function readFileText(file: Blob): Promise<string> {
	if (typeof file.arrayBuffer !== "function") return file.text();
	const bytes = await file.arrayBuffer();
	if (bytes?.byteLength)
		return new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes);
	return file.text();
}
