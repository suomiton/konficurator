module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'jsdom',
	roots: ['<rootDir>/src', '<rootDir>/tests'],
	testMatch: [
		'**/__tests__/**/*.+(ts|tsx|js)',
		'**/*.(test|spec).+(ts|tsx|js)'
	],
	testPathIgnorePatterns: [
		"<rootDir>/tests/unit/dom-renderer.test.ts",
		"<rootDir>/tests/unit/modern-form-renderer.test.ts",
		"<rootDir>/tests/unit/file-conflict-detection.test.ts"
	],
	transform: {
		'^.+\\.(ts|tsx)$': 'ts-jest'
	},
	collectCoverageFrom: [
		'src/**/*.{ts,tsx}',
		'!src/**/*.d.ts',
		'!src/**/index.ts'
	],
	coverageDirectory: 'coverage',
	coverageReporters: ['text', 'lcov', 'html'],
	setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
	moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
	testTimeout: 10000,
	moduleNameMapper: {
		'^@/(.*)$': '<rootDir>/src/$1',
		'../parser-wasm/pkg/parser_core.js': '<rootDir>/tests/__mocks__/parser_core.js',
		'./persistence': '<rootDir>/tests/__mocks__/persistence.js',
		'../persistence': '<rootDir>/tests/__mocks__/persistence.js'
	},
	transformIgnorePatterns: [
		'/node_modules/',
		'!parser-wasm/pkg/'
	]
};
