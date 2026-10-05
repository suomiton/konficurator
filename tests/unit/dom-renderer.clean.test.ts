import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import {
	FormFieldData,
	TextFieldData,
	NumberFieldData,
	BooleanFieldData,
	ArrayFieldData,
} from "../../src/ui/form-data";

const mockRenderFormField = jest.fn() as jest.MockedFunction<
	(fieldData: FormFieldData) => HTMLElement
>;
const mockRenderFileHeader = jest.fn() as jest.MockedFunction<
	(
		fileId: string,
		fileName: string,
		fileType: string,
		hasHandle?: boolean
	) => HTMLElement
>;
const mockRenderErrorNotification = jest.fn() as jest.MockedFunction<
	(message: string) => HTMLElement
>;

jest.mock("../../src/ui/dom-renderer", () => ({
	renderFormField: mockRenderFormField,
	renderFileHeader: mockRenderFileHeader,
	renderErrorNotification: mockRenderErrorNotification,
}));

import {
	renderFormField,
	renderFileHeader,
	renderErrorNotification,
} from "../../src/ui/dom-renderer";

describe("DOM Renderer (clean)", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		document.body.innerHTML = "";
		mockRenderFormField.mockImplementation((fieldData: FormFieldData) => {
			const el = document.createElement("div");
			el.className = `form-field form-field-${fieldData.type}`;
			el.textContent = `${fieldData.label}: ${fieldData.value}`;
			return el;
		});
		mockRenderFileHeader.mockImplementation((fid, name, type) => {
			const el = document.createElement("div");
			el.className = "file-header";
			el.setAttribute("data-id", fid);
			el.textContent = `${name} (${type})`;
			return el;
		});
		mockRenderErrorNotification.mockImplementation((msg) => {
			const el = document.createElement("div");
			el.className = "error-notification";
			el.textContent = msg;
			return el;
		});
	});

	it("renders text field", () => {
		const f: TextFieldData = {
			type: "text",
			value: "v",
			path: "p",
			label: "Label",
			key: "p",
		};
		renderFormField(f);
		expect(mockRenderFormField).toHaveBeenCalledWith(f);
	});

	it("renders number field", () => {
		const f: NumberFieldData = {
			type: "number",
			value: 1,
			path: "n",
			label: "Num",
			key: "n",
		};
		renderFormField(f);
		expect(mockRenderFormField).toHaveBeenCalledWith(f);
	});

	it("renders boolean field", () => {
		const f: BooleanFieldData = {
			type: "boolean",
			value: false,
			checked: false,
			path: "b",
			label: "Bool",
			key: "b",
		};
		renderFormField(f);
		expect(mockRenderFormField).toHaveBeenCalledWith(f);
	});

	it("renders array field", () => {
		const f: ArrayFieldData = {
			type: "array",
			value: ["x"],
			path: "a",
			label: "Arr",
			key: "a",
			jsonValue: '["x"]',
		};
		renderFormField(f);
		expect(mockRenderFormField).toHaveBeenCalledWith(f);
	});

	it("renders header", () => {
		renderFileHeader("fid", "file.json", "json");
		expect(mockRenderFileHeader).toHaveBeenCalledWith(
			"fid",
			"file.json",
			"json"
		);
	});

	it("renders error notification", () => {
		renderErrorNotification("Err");
		expect(mockRenderErrorNotification).toHaveBeenCalledWith("Err");
	});
});
