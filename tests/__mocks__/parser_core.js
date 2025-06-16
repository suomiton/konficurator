// Mock for WebAssembly module parser_core.js
const mockInit = jest.fn().mockResolvedValue(true);
const mockUpdateValue = jest.fn().mockImplementation((fileType, content, path, newVal) => {
	// Simple mock implementation that just returns modified content
	return `${content.substring(0, 10)}...${newVal}...${content.substring(content.length - 10)}`;
});

module.exports = {
	__esModule: true,
	default: mockInit,
	update_value: mockUpdateValue
};
