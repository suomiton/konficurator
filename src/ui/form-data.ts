import { ParsedData, FieldType } from "../interfaces";

/**
 * Pure functions for form field creation - no DOM manipulation, just data transformation
 */

export interface FormFieldData {
	key: string;
	value: any;
	path: string;
	type: FieldType;
	label: string;
}

export interface TextFieldData extends FormFieldData {
	type: "text";
	inputType?: "text" | "email" | "url" | "password";
}

export interface NumberFieldData extends FormFieldData {
	type: "number";
	min?: number;
	max?: number;
	step?: number;
}

export interface BooleanFieldData extends FormFieldData {
	type: "boolean";
	checked: boolean;
}

export interface ArrayFieldData extends FormFieldData {
	type: "array";
	jsonValue: string;
	rows?: number;
	items?: any[];
}

export interface ObjectFieldData extends FormFieldData {
	type: "object";
	children: FormFieldData[];
}

export interface XmlHeadingFieldData extends FormFieldData {
        type: "xml-heading";
        attributes?: Record<string, any>;
        attributeFields?: XmlAttributeField[];
        children: FormFieldData[];
}

export interface XmlValueFieldData extends FormFieldData {
        type: "xml-value";
        textValue: string;
        attributes?: Record<string, any>;
        attributeFields?: XmlAttributeField[];
}

export interface XmlAttributesFieldData extends FormFieldData {
        type: "xml-attributes";
        attributes: Record<string, any>;
        attributeFields?: XmlAttributeField[];
}

export interface XmlAttributeField {
        key: string;
        label: string;
        path: string;
        value: any;
        inputType: "text" | "number" | "boolean";
}

export type AnyFormFieldData =
	| TextFieldData
	| NumberFieldData
	| BooleanFieldData
	| ArrayFieldData
	| ObjectFieldData
	| XmlHeadingFieldData
	| XmlValueFieldData
	| XmlAttributesFieldData;

/**
 * Pure function to determine field type from value
 */
export function determineFieldType(value: any): FieldType {
	if (value === null || value === undefined) {
		return "text";
	}

	// Handle XML-specific types
	if (typeof value === "object" && value["@type"]) {
		switch (value["@type"]) {
			case "heading":
				return "xml-heading";
			case "value":
				return "xml-value";
			case "attributes":
				return "xml-attributes";
		}
	}

	if (Array.isArray(value)) {
		return "array";
	}

	switch (typeof value) {
		case "boolean":
			return "boolean";
		case "number":
			return "number";
		case "object":
			return "object";
		default:
			return "text";
	}
}

/**
 * Pure function to format field labels
 */
export function formatLabel(key: string): string {
	return key
		.replace(/([a-z])([A-Z])/g, "$1 $2") // Add space before capital letters (only when preceded by lowercase)
		.replace(/^./, (str) => str.toUpperCase()) // Capitalize first letter
		.replace(/_/g, " ") // Replace underscores with spaces
		.replace(/\s+/g, " ") // Replace multiple spaces with single space
		.trim();
}

/**
 * Pure function to determine HTML input type for values
 */
export function determineInputType(value: any): string {
	if (typeof value === "boolean") {
		return "checkbox";
	}
	if (typeof value === "number") {
		return "number";
	}
	// Could be extended to detect email, url, etc.
	return "text";
}

/**
 * Pure function to convert parsed data to form field data structure
 */
// Patch: filter out @type, @value, @attributes from XML children and use tag names as labels
export function createFormFieldData(
        key: string,
        value: any,
        path: string
): AnyFormFieldData {
	const baseData: Partial<FormFieldData> = {
		key,
		value,
		path,
		label: formatLabel(key.startsWith("@") ? key.replace(/^@/, "") : key),
	};

	const type = determineFieldType(value);

	switch (type) {
		case "array":
			return {
				...baseData,
				type: "array",
				jsonValue: JSON.stringify(value, null, 2),
				rows: Math.min(
					Math.max(3, JSON.stringify(value, null, 2).split("\n").length),
					10
				),
				items: Array.isArray(value) ? value : [],
			} as ArrayFieldData;

		case "object":
			const children = Object.entries(value).map(([childKey, childValue]) => {
				const childPath = path ? `${path}.${childKey}` : childKey;
				return createFormFieldData(childKey, childValue, childPath);
			});
			return {
				...baseData,
				type: "object",
				children,
			} as ObjectFieldData;

                case "xml-heading":
                        const headingAttributes = createXmlAttributeFields(
                                value["@attributes"],
                                path
                        );
                        const xmlHeadingChildren = Object.entries(value)
                                .filter(([k]) => k !== "@type" && k !== "@value" && k !== "@attributes")
                                .map(([childKey, childValue]) => {
                                        const childPath = path ? `${path}.${childKey}` : childKey;
                                        return createFormFieldData(childKey, childValue, childPath);
                                });
                        return {
                                ...baseData,
                                type: "xml-heading",
                                attributes: value["@attributes"],
                                attributeFields: headingAttributes,
                                children: xmlHeadingChildren,
                        } as XmlHeadingFieldData;

                case "xml-value":
                        const valueAttributes = createXmlAttributeFields(
                                value["@attributes"],
                                path
                        );
                        return {
                                ...baseData,
                                type: "xml-value",
                                textValue: String(value["@value"] ?? value ?? ""),
                                attributes: value["@attributes"],
                                attributeFields: valueAttributes,
                        } as XmlValueFieldData;

                case "xml-attributes":
                        const attributeFields = createXmlAttributeFields(
                                value["@attributes"],
                                path
                        );
                        return {
                                ...baseData,
                                type: "xml-attributes",
                                attributes: value["@attributes"] || {},
                                attributeFields,
                        } as XmlAttributesFieldData;

		default:
			return {
				...baseData,
				type:
					typeof value === "number"
						? "number"
						: typeof value === "boolean"
						? "boolean"
						: "text",
				value: value,
			} as TextFieldData;
	}
}

function createXmlAttributeFields(
        attributes: Record<string, any> | undefined,
        path: string
): XmlAttributeField[] {
        if (!attributes) {
                return [];
        }

        return Object.entries(attributes).map(([attrKey, attrValue]) => {
                const attributePath = path ? `${path}.@${attrKey}` : `@${attrKey}`;
                return {
                        key: attrKey,
                        label: formatLabel(attrKey),
                        path: attributePath,
                        value: attrValue,
                        inputType:
                                typeof attrValue === "boolean"
                                        ? "boolean"
                                        : typeof attrValue === "number"
                                        ? "number"
                                        : "text",
                };
        });
}

/**
 * Pure function to generate form fields data from parsed data
 */
export function generateFormFieldsData(
	data: ParsedData,
	path: string = ""
): AnyFormFieldData[] {
	return Object.entries(data)
		.filter(
			([key]) =>
				// Hide @type, @value, and @attributes fields for XML - these are handled by XML-specific field types
				key !== "@type" && key !== "@value" && key !== "@attributes"
		)
		.map(([key, value]) => {
			const fieldPath = path ? `${path}.${key}` : key;
			return createFormFieldData(key, value, fieldPath);
		});
}
