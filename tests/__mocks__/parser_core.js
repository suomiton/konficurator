// Mock for WebAssembly module parser_core.js
const mockInit = jest.fn().mockResolvedValue(true);
const mockUpdateValue = jest.fn().mockImplementation((fileType, content, path, newVal) => {
	// Simple mock implementation that just returns modified content
	return `${content.substring(0, 10)}...${newVal}...${content.substring(content.length - 10)}`;
});
const mockValidate = jest.fn().mockReturnValue({ valid: true });
const mockValidateMulti = jest
	.fn()
	.mockReturnValue({ valid: true, errors: [], summary: undefined });
const mockValidateSchema = jest.fn().mockReturnValue({ valid: true, errors: [] });
const mockValidateSchemaWithId = jest.fn().mockReturnValue({ valid: true, errors: [] });
const mockRegisterSchema = jest.fn();

module.exports = {
	__esModule: true,
	default: mockInit,
	update_value: mockUpdateValue,
	validate: mockValidate,
	validate_multi: mockValidateMulti,
	validate_schema: mockValidateSchema,
	validate_schema_with_id: mockValidateSchemaWithId,
	register_schema: mockRegisterSchema
};
