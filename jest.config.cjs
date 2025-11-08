module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'jsdom',
	roots: ['<rootDir>/src', '<rootDir>/tests'],
	testMatch: [
		'**/__tests__/**/*.+(ts|tsx|js)',
		'**/*.(test|spec).+(ts|tsx|js)'
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
                '^(\\.{1,2}/(?!parser-wasm/).*)\\.js$': '$1',
                '../parser-wasm/pkg/parser_core.js': '<rootDir>/tests/__mocks__/parser_core.js',
                './persistence.js': '<rootDir>/tests/__mocks__/persistence.js',
                '../persistence.js': '<rootDir>/tests/__mocks__/persistence.js'
        },
	transformIgnorePatterns: [
		'/node_modules/',
		'!parser-wasm/pkg/'
	]
};
