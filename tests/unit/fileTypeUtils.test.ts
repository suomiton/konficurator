import { determineFileType } from "../../src/utils/fileTypeUtils";

test.each([
	".env",
	".env.local",
	".env.production",
	"app.properties",
	"app.ini",
	"APP.INI",
])("detects %s as text configuration", (name) => {
	expect(determineFileType(name)).toBe("env");
});
test.each([
	["{invalid", "json"],
	["<configuration/>", "xml"],
	["export database.host=local", "env"],
])("sniffs config without requiring it to be valid", (text, expected) => {
	expect(determineFileType("app.config", text)).toBe(expected);
});
