declare module "../parser-wasm/pkg/parser_core.js" {
        export default function init(...args: unknown[]): Promise<void>;
        export function update_value(
                fileType: string,
                originalContent: string,
                path: string[],
                newValue: string
        ): string;
}
