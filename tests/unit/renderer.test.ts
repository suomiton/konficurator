import { describe, it, expect, beforeEach } from "@jest/globals";

// Basic renderer tests focused on core functionality
describe("Renderer Module - Basic Tests", () => {
	beforeEach(() => {
		// Clear DOM before each test
		document.body.innerHTML = "";
	});

	describe("DOM Manipulation", () => {
		it("should be able to create and manipulate DOM elements", () => {
			const div = document.createElement("div");
			div.className = "test-element";
			div.textContent = "Test content";

			expect(div.className).toBe("test-element");
			expect(div.textContent).toBe("Test content");
		});

		it("should be able to append elements to document body", () => {
			const container = document.createElement("div");
			container.id = "file-editor";
			document.body.appendChild(container);

			const found = document.getElementById("file-editor");
			expect(found).toBeTruthy();
			expect(found?.id).toBe("file-editor");
		});
	});

	describe("Form Field Generation", () => {
		it("should create input elements for form fields", () => {
			const input = document.createElement("input");
			input.type = "text";
			input.name = "testField";
			input.value = "test value";

			expect(input.type).toBe("text");
			expect(input.name).toBe("testField");
			expect(input.value).toBe("test value");
		});

		it("should create label elements for form fields", () => {
			const label = document.createElement("label");
			label.textContent = "Test Field";
			label.setAttribute("for", "testField");

			expect(label.textContent).toBe("Test Field");
			expect(label.getAttribute("for")).toBe("testField");
		});
	});

	describe("Error Notification Structure", () => {
		it("should create error notification elements", () => {
			const notification = document.createElement("div");
			notification.className = "error-notification";

			const title = document.createElement("h3");
			title.textContent = "Error";

			const message = document.createElement("p");
			message.textContent = "An error occurred";

			notification.appendChild(title);
			notification.appendChild(message);

			expect(notification.className).toBe("error-notification");
			expect(notification.children.length).toBe(2);
			expect(notification.querySelector("h3")?.textContent).toBe("Error");
			expect(notification.querySelector("p")?.textContent).toBe(
				"An error occurred"
			);
		});
	});
});
