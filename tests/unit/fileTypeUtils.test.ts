/**
 * Unit tests for fileTypeUtils module
 * Tests file type detection logic and utility functions
 */

import {
	determineFileType,
	getFileTypeDisplayName,
	getMimeTypeForFileType,
	getExtensionsForFileType,
	SupportedFileType,
} from "../../src/utils/fileTypeUtils.js";

describe("fileTypeUtils", () => {
	describe("determineFileType", () => {
		describe("Extension-based detection", () => {
			test("should detect JSON files by extension", () => {
				expect(determineFileType("config.json")).toBe("json");
				expect(determineFileType("package.json")).toBe("json");
				expect(determineFileType("data.JSON")).toBe("json"); // Case insensitive
			});

			test("should detect XML files by extension", () => {
				expect(determineFileType("config.xml")).toBe("xml");
				expect(determineFileType("server.XML")).toBe("xml"); // Case insensitive
			});

			test("should detect ENV files by extension", () => {
				expect(determineFileType("app.env")).toBe("env");
				expect(determineFileType(".env")).toBe("env");
				expect(determineFileType("production.ENV")).toBe("env"); // Case insensitive
			});

			test("should default to JSON for unknown extensions", () => {
				expect(determineFileType("unknown.txt")).toBe("json");
				expect(determineFileType("file.unknown")).toBe("json");
				expect(determineFileType("noextension")).toBe("json");
			});
		});

		describe("Content-based detection for .config files", () => {
			test("should detect JSON content in .config files", () => {
				const jsonContent = `{
					"database": {
						"host": "localhost",
						"port": 5432
					}
				}`;
				expect(determineFileType("app.config", jsonContent)).toBe("json");

				// Array JSON
				const arrayContent = `["item1", "item2", "item3"]`;
				expect(determineFileType("list.config", arrayContent)).toBe("json");

				// Minified JSON
				const minifiedContent = `{"key":"value","nested":{"prop":true}}`;
				expect(determineFileType("mini.config", minifiedContent)).toBe("json");
			});

			test("should detect XML content in .config files", () => {
				const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
				<configuration>
					<database>
						<host>localhost</host>
						<port>5432</port>
					</database>
				</configuration>`;
				expect(determineFileType("app.config", xmlContent)).toBe("xml");

				// XML without declaration
				const simpleXml = `<config>
					<setting name="debug" value="true" />
				</config>`;
				expect(determineFileType("simple.config", simpleXml)).toBe("xml");

				// XML with whitespace
				const spacedXml = `  
				<?xml version="1.0"?>
				<root></root>`;
				expect(determineFileType("spaced.config", spacedXml)).toBe("xml");
			});

			test("should detect ENV content in .config files", () => {
				const envContent = `
				# Database configuration
				DATABASE_HOST=localhost
				DATABASE_PORT=5432
				DEBUG_MODE=true
				
				# Security settings
				SESSION_SECRET=mysecret123
				JWT_EXPIRY=3600
				`;
				expect(determineFileType("app.config", envContent)).toBe("env");

				// Simple ENV
				const simpleEnv = `KEY1=value1
				KEY2=value2`;
				expect(determineFileType("simple.config", simpleEnv)).toBe("env");

				// ENV with mixed case (should still detect)
				const mixedEnv = `
				database_host=localhost
				DATABASE_PORT=5432
				Api_Key=secret
				`;
				expect(determineFileType("mixed.config", mixedEnv)).toBe("env");
			});

			test("should default to config for unrecognized .config content", () => {
				const customContent = `
				This is some custom configuration format
				that doesn't match JSON, XML, or ENV patterns.
				
				section1:
					option1 = value1
					option2 = value2
				`;
				expect(determineFileType("custom.config", customContent)).toBe("config");

				// Empty content
				expect(determineFileType("empty.config", "")).toBe("config");
				expect(determineFileType("whitespace.config", "   \n  \t  ")).toBe("config");
			});

			test("should handle invalid JSON gracefully", () => {
				const invalidJson = `{
					"key": "value",
					"invalid": 
				}`;
				expect(determineFileType("invalid.config", invalidJson)).toBe("config");

				// Almost JSON but not quite
				const almostJson = `{key: value}`;
				expect(determineFileType("almost.config", almostJson)).toBe("config");
			});

			test("should handle edge cases in content detection", () => {
				// Content that starts with { but isn't JSON
				const fakeJson = `{this is not JSON}`;
				expect(determineFileType("fake.config", fakeJson)).toBe("config");

				// Content that starts with < but isn't XML
				const fakeXml = `<this is not XML>`;
				expect(determineFileType("fake.config", fakeXml)).toBe("xml");

				// Content with comments only
				const commentsOnly = `
				# Comment 1
				# Comment 2
				# Comment 3
				`;
				expect(determineFileType("comments.config", commentsOnly)).toBe("config");
			});
		});

		describe("Content detection without extension override", () => {
			test("should use extension for non-.config files even with content", () => {
				const jsonContent = `{"key": "value"}`;
				expect(determineFileType("file.xml", jsonContent)).toBe("xml");
				expect(determineFileType("file.env", jsonContent)).toBe("env");
				expect(determineFileType("file.json", jsonContent)).toBe("json");
			});
		});

		describe("Case insensitivity", () => {
			test("should handle mixed case extensions", () => {
				expect(determineFileType("FILE.JSON")).toBe("json");
				expect(determineFileType("file.Xml")).toBe("xml");
				expect(determineFileType("file.ENV")).toBe("env");
				expect(determineFileType("file.Config")).toBe("config");
			});
		});
	});

	describe("getFileTypeDisplayName", () => {
		test("should return uppercase display names", () => {
			expect(getFileTypeDisplayName("json")).toBe("JSON");
			expect(getFileTypeDisplayName("xml")).toBe("XML");
			expect(getFileTypeDisplayName("config")).toBe("CONFIG");
			expect(getFileTypeDisplayName("env")).toBe("ENV");
		});
	});

	describe("getMimeTypeForFileType", () => {
		test("should return correct MIME types", () => {
			expect(getMimeTypeForFileType("json")).toBe("application/json");
			expect(getMimeTypeForFileType("xml")).toBe("application/xml");
			expect(getMimeTypeForFileType("config")).toBe("application/xml");
			expect(getMimeTypeForFileType("env")).toBe("text/plain");
		});

		test("should default to JSON MIME type for unknown types", () => {
			expect(getMimeTypeForFileType("unknown" as SupportedFileType)).toBe("application/json");
		});
	});

	describe("getExtensionsForFileType", () => {
		test("should return correct file extensions", () => {
			expect(getExtensionsForFileType("json")).toEqual([".json"]);
			expect(getExtensionsForFileType("xml")).toEqual([".xml"]);
			expect(getExtensionsForFileType("config")).toEqual([".config"]);
			expect(getExtensionsForFileType("env")).toEqual([".env"]);
		});

		test("should default to JSON extension for unknown types", () => {
			expect(getExtensionsForFileType("unknown" as SupportedFileType)).toEqual([".json"]);
		});
	});

	describe("ENV format detection edge cases", () => {
		test("should handle ENV format variations", () => {
			// Standard ENV format
			const standardEnv = `
			DATABASE_URL=postgres://localhost/mydb
			API_KEY=abc123
			DEBUG=true
			`;
			expect(determineFileType("app.config", standardEnv)).toBe("env");

			// ENV with spacing around equals
			const spacedEnv = `
			KEY1 = value1
			KEY2= value2
			KEY3 =value3
			`;
			expect(determineFileType("spaced.config", spacedEnv)).toBe("env");

			// ENV with mixed content (should still detect as ENV if majority are ENV-like)
			const mixedEnv = `
			# Configuration file
			DATABASE_HOST=localhost
			DATABASE_PORT=5432
			some random line
			API_SECRET=mysecret
			`;
			expect(determineFileType("mixed.config", mixedEnv)).toBe("env");

			// Not enough ENV-like lines (should not be detected as ENV)
			const notEnoughEnv = `
			This is mostly text
			with some content
			KEY1=value1
			and more text
			that is not ENV format
			`;
			expect(determineFileType("not-env.config", notEnoughEnv)).toBe("config");
		});

		test("should handle empty and comment-only content", () => {
			const emptyContent = "";
			expect(determineFileType("empty.config", emptyContent)).toBe("config");

			const commentsOnly = `
			# Comment 1
			# Comment 2
			`;
			expect(determineFileType("comments.config", commentsOnly)).toBe("config");

			const whitespaceOnly = "   \n  \t  \n  ";
			expect(determineFileType("whitespace.config", whitespaceOnly)).toBe("config");
		});
	});

	describe("Real-world scenarios", () => {
		test("should handle actual config file contents", () => {
			// Spring Boot application.properties style
			const springConfig = `
			server.port=8080
			spring.datasource.url=jdbc:postgresql://localhost/testdb
			spring.datasource.username=dbuser
			spring.datasource.password=dbpass
			logging.level.com.example=DEBUG
			`;
			expect(determineFileType("application.config", springConfig)).toBe("env");

			// Docker environment file
			const dockerEnv = `
			POSTGRES_DB=myapp
			POSTGRES_USER=myuser
			POSTGRES_PASSWORD=mypassword
			REDIS_URL=redis://localhost:6379
			NODE_ENV=production
			`;
			expect(determineFileType("docker.config", dockerEnv)).toBe("env");

			// JSON configuration
			const jsonConfig = `{
				"server": {
					"port": 3000,
					"host": "localhost"
				},
				"database": {
					"connectionString": "mongodb://localhost/myapp",
					"options": {
						"useNewUrlParser": true
					}
				}
			}`;
			expect(determineFileType("app.config", jsonConfig)).toBe("json");

			// XML configuration (like web.xml)
			const xmlConfig = `<?xml version="1.0" encoding="UTF-8"?>
			<configuration>
				<appSettings>
					<add key="DatabaseConnection" value="Server=localhost;Database=MyApp;" />
					<add key="EnableLogging" value="true" />
				</appSettings>
			</configuration>`;
			expect(determineFileType("web.config", xmlConfig)).toBe("xml");
		});
	});
});
