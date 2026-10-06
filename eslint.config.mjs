import parser from "@typescript-eslint/parser";

export default [
	{
		files: ["src/**/*.ts"],
		ignores: ["src/**/*.d.ts"],
		languageOptions: {
			parser,
			parserOptions: { ecmaVersion: "latest", sourceType: "module" },
		},
		rules: {
			"no-dupe-keys": "error",
			"no-unreachable": "error",
			"no-constant-condition": "error",
			"constructor-super": "error",
			"valid-typeof": "error",
			"prefer-const": "error",
		},
	},
];
