import init from "../parser-wasm/pkg/parser_core.js";

let initialization: Promise<unknown> | undefined;
export function ensureWasmInitialized(): Promise<unknown> {
	return (initialization ??= init().catch((error: unknown) => {
		initialization = undefined;
		throw error;
	}));
}
