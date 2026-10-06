/* tslint:disable */
/* eslint-disable */
export function parse_tree(file_type: string, content: string): ParseNode;
export function update_value(file_type: string, content: string, path: string[], new_val: string): string;
/**
 * Structural array edits splice only the item and its separator.
 */
export function edit_array(content: string, path: string[], index?: number | null, value?: string | null): string;
export function validate(file_type: string, content: string): ValidationResult;
export function validate_multi(file_type: string, content: string, max_errors?: number | null): MultiValidationResult;
export function validate_schema(content: string, schema: string, options?: any | null): SchemaValidationResult;
export function validate_schema_with_id(content: string, schema_id: string, options: SchemaValidationOptions): SchemaValidationResult;
export function register_schema(schema_id: string, schema: string): void;

export interface ParseNode {
  key: string; path: string[]; kind: string; value: string | null;
  span: { start: number; end: number }; children: ParseNode[]; quote: string | null;
}
export interface ValidationError {
  message: string; code?: string; line: number; column: number; start: number; end: number;
}
export interface ValidationResult {
  valid: boolean; message?: string; line?: number; column?: number; start?: number; end?: number;
}
export interface MultiValidationResult {
  valid: boolean; errors: ValidationError[]; summary?: ValidationError | null;
}
export interface SchemaValidationError {
  message: string; keyword?: string | null; instancePath: string; schemaPath?: string | null;
  line?: number | null; column?: number | null; start?: number | null; end?: number | null;
}
export interface SchemaValidationResult { valid: boolean; errors: SchemaValidationError[]; }
export interface SchemaValidationOptions { maxErrors?: number; collectPositions?: boolean; draft?: string; }



export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly edit_array: (a: number, b: number, c: any, d: number, e: number, f: number) => [number, number, number, number];
  readonly parse_tree: (a: number, b: number, c: number, d: number) => [number, number, number];
  readonly register_schema: (a: number, b: number, c: number, d: number) => [number, number];
  readonly update_value: (a: number, b: number, c: number, d: number, e: any, f: number, g: number) => [number, number, number, number];
  readonly validate: (a: number, b: number, c: number, d: number) => any;
  readonly validate_multi: (a: number, b: number, c: number, d: number, e: number) => any;
  readonly validate_schema: (a: number, b: number, c: number, d: number, e: number) => any;
  readonly validate_schema_with_id: (a: number, b: number, c: number, d: number, e: number) => any;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly __externref_table_alloc: () => number;
  readonly __wbindgen_externrefs: WebAssembly.Table;
  readonly __externref_table_dealloc: (a: number) => void;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
