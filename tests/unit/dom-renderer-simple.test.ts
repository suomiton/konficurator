/**
 * Simple test to verify Jest setup works with DOM renderer
 */

import { describe, it, expect } from "@jest/globals";

describe("DOM Renderer Test Setup", () => {
	it("should run a basic test", () => {
		expect(true).toBe(true);
	});

	it("should have access to DOM", () => {
		const div = document.createElement("div");
		expect(div.tagName).toBe("DIV");
	});
});
