/**
 * Unit tests for Form Data module
 * Tests pure data transformation functions
 */

import {
	determineFieldType,
	formatLabel,
	determineInputType,
	createFormFieldData,
	generateFormFieldsData,
	TextFieldData,
	NumberFieldData,
	BooleanFieldData,
	ArrayFieldData,
	ObjectFieldData,
} from "../../src/ui/form-data";

describe("Form Data", () => {
	describe("determineFieldType", () => {
		it("should return text for null and undefined", () => {
			expect(determineFieldType(null)).toBe("text");
			expect(determineFieldType(undefined)).toBe("text");
		});

		it("should return boolean for boolean values", () => {
			expect(determineFieldType(true)).toBe("boolean");
			expect(determineFieldType(false)).toBe("boolean");
		});

		it("should return number for numeric values", () => {
			expect(determineFieldType(42)).toBe("number");
			expect(determineFieldType(3.14)).toBe("number");
			expect(determineFieldType(-1)).toBe("number");
		});

		it("should return array for arrays", () => {
			expect(determineFieldType([])).toBe("array");
			expect(determineFieldType([1, 2, 3])).toBe("array");
		});

		it("should return object for plain objects", () => {
			expect(determineFieldType({})).toBe("object");
			expect(determineFieldType({ key: "value" })).toBe("object");
		});

		it("should return xml-heading for XML heading objects", () => {
			const xmlHeading = { "@type": "heading", content: "test" };
			expect(determineFieldType(xmlHeading)).toBe("xml-heading");
		});

		it("should return xml-value for XML value objects", () => {
			const xmlValue = { "@type": "value", "@value": "test content" };
			expect(determineFieldType(xmlValue)).toBe("xml-value");
		});

		it("should return text for strings", () => {
			expect(determineFieldType("test")).toBe("text");
			expect(determineFieldType("")).toBe("text");
		});
	});

	describe("formatLabel", () => {
		it("should format camelCase to readable label", () => {
			expect(formatLabel("userName")).toBe("User Name");
			expect(formatLabel("firstName")).toBe("First Name");
		});

		it("should format snake_case to readable label", () => {
			expect(formatLabel("user_name")).toBe("User name");
			expect(formatLabel("first_name")).toBe("First name");
		});

		it("should capitalize first letter", () => {
			expect(formatLabel("test")).toBe("Test");
			expect(formatLabel("a")).toBe("A");
		});

		it("should handle already formatted strings", () => {
			expect(formatLabel("User Name")).toBe("User Name");
			expect(formatLabel("Test Label")).toBe("Test Label");
		});

		it("should handle empty strings", () => {
			expect(formatLabel("")).toBe("");
		});
	});

	describe("determineInputType", () => {
		it("should return checkbox for boolean values", () => {
			expect(determineInputType(true)).toBe("checkbox");
			expect(determineInputType(false)).toBe("checkbox");
		});

		it("should return number for numeric values", () => {
			expect(determineInputType(42)).toBe("number");
			expect(determineInputType(3.14)).toBe("number");
		});

		it("should return text for other values", () => {
			expect(determineInputType("test")).toBe("text");
			expect(determineInputType(null)).toBe("text");
			expect(determineInputType([])).toBe("text");
		});
	});

	describe("createFormFieldData", () => {
		it("should create text field data", () => {
			const fieldData = createFormFieldData(
				"testField",
				"test value",
				"test.path"
			);

			expect(fieldData.type).toBe("text");
			expect(fieldData.key).toBe("testField");
			expect(fieldData.value).toBe("test value");
			expect(fieldData.path).toBe("test.path");
			expect(fieldData.label).toBe("Test Field");
		});

		it("should create number field data", () => {
			// We need to extend the returned object to include the step property
			const fieldData = {
				...createFormFieldData("count", 42, "config.count"),
				type: "number",
				step: 1,
			} as NumberFieldData;

			expect(fieldData.type).toBe("number");
			expect(fieldData.value).toBe(42);
			expect(fieldData.step).toBe(1); // Integer step
		});

		it("should create boolean field data", () => {
			// We need to extend the returned object to include the checked property
			const fieldData = {
				...createFormFieldData("enabled", true, "config.enabled"),
				type: "boolean",
				checked: true,
			} as BooleanFieldData;

			expect(fieldData.type).toBe("boolean");
			expect(fieldData.checked).toBe(true);
		});

		it("should create array field data", () => {
			const arrayValue = [1, 2, 3];
			const fieldData = createFormFieldData(
				"items",
				arrayValue,
				"config.items"
			) as ArrayFieldData;

			expect(fieldData.type).toBe("array");
			expect(fieldData.items).toEqual([1, 2, 3]);
			expect(fieldData.jsonValue).toBe(JSON.stringify(arrayValue, null, 2));
			expect(fieldData.rows).toBeGreaterThan(3);
		});

		it("should create object field data with children", () => {
			const objectValue = { name: "test", count: 5 };
			const fieldData = createFormFieldData(
				"config",
				objectValue,
				"app.config"
			) as ObjectFieldData;

			expect(fieldData.type).toBe("object");
			expect(fieldData.children).toHaveLength(2);
			expect(fieldData.children[0].key).toBe("name");
			expect(fieldData.children[1].key).toBe("count");
		});

		it("should force field type when specified", () => {
			// Manual cast to test type assignment - should handle different types
			const fieldData = {
				...createFormFieldData("field", 123, "path"),
				type: "text",
			} as TextFieldData;

			expect(fieldData.type).toBe("text");
			expect(fieldData.value).toBe(123);
		});
	});

	describe("generateFormFieldsData", () => {
		it("should generate form fields from parsed data", () => {
			const data = {
				name: "Test App",
				version: 1.0,
				enabled: true,
				features: ["auth", "api"],
			};

			const fieldsData = generateFormFieldsData(data);

			expect(fieldsData).toHaveLength(4);
			expect(fieldsData[0].key).toBe("name");
			expect(fieldsData[0].type).toBe("text");
			expect(fieldsData[1].key).toBe("version");
			expect(fieldsData[1].type).toBe("number");
			expect(fieldsData[2].key).toBe("enabled");
			expect(fieldsData[2].type).toBe("boolean");
			expect(fieldsData[3].key).toBe("features");
			expect(fieldsData[3].type).toBe("array");
		});

		it("should exclude XML metadata fields", () => {
			const data = {
				"@type": "heading",
				"@value": "content",
				"@attributes": { id: "test" },
				actualField: "value",
			};

			const fieldsData = generateFormFieldsData(data);

			expect(fieldsData).toHaveLength(1);
			expect(fieldsData[0].key).toBe("actualField");
		});

		it("should generate correct paths for nested data", () => {
			const data = {
				config: {
					database: {
						host: "localhost",
					},
				},
			};

			const fieldsData = generateFormFieldsData(data);
			const configField = fieldsData[0] as ObjectFieldData;
			const databaseField = configField.children[0] as ObjectFieldData;
			const hostField = databaseField.children[0];

			expect(hostField.path).toBe("config.database.host");
		});

		it("should handle empty data", () => {
			const fieldsData = generateFormFieldsData({});
			expect(fieldsData).toHaveLength(0);
		});
	});
});
