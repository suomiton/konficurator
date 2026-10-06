import {
	setupFormEventListeners,
	setupFileActionEventListeners,
} from "../../src/ui/event-handlers";

describe("Delegated form events", () => {
	afterEach(() => document.body.replaceChildren());
	test("handles current and newly inserted inputs without numeric coercion", () => {
		const editor = document.createElement("div");
		editor.className = "file-editor";
		editor.dataset.id = "id";
		const form = document.createElement("form");
		editor.append(form);
		document.body.append(editor);
		const changed = jest.fn();
		setupFormEventListeners(form, { onFileFieldChange: changed });
		const input = document.createElement("input");
		input.dataset.path = '["a.b","0"]';
		input.dataset.kind = "number";
		input.value = "1.10";
		form.append(input);
		input.dispatchEvent(new Event("input", { bubbles: true }));
		expect(changed).toHaveBeenCalledWith(
			"id",
			'["a.b","0"]',
			"1.10",
			"number"
		);
		input.type = "checkbox";
		input.checked = false;
		input.dispatchEvent(new Event("change", { bubbles: true }));
		expect(changed).toHaveBeenLastCalledWith(
			"id",
			'["a.b","0"]',
			"false",
			"number"
		);
	});
	test("prevents native form submission", () => {
		const form = document.createElement("form");
		setupFormEventListeners(form);
		expect(
			form.dispatchEvent(new Event("submit", { cancelable: true }))
		).toBe(false);
	});
	test("routes file actions by stable id", () => {
		const header = document.createElement("div");
		header.innerHTML =
			'<button class="minimize-file-btn" data-id="id">Minimize</button>';
		const callback = jest.fn();
		setupFileActionEventListeners(header, "same-name.json", {
			onFileMinimize: callback,
		});
		(header.firstChild as HTMLButtonElement).click();
		expect(callback).toHaveBeenCalledWith("id");
	});
});
