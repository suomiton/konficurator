import { readFileText } from "../../src/utils/readFileText";

test("retains the BOM and CRLF when reading a real UTF-8 buffer", async () => {
	const text = '\uFEFF{"a":1}\r\n';
	const bytes = new TextEncoder().encode(text);
	const file = {
		arrayBuffer: async () => bytes.buffer,
		text: async () => text.slice(1),
	} as Blob;
	expect(await readFileText(file)).toBe(text);
});
