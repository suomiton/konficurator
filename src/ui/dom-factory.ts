/**
 * Pure DOM factory functions - no side effects, easy to test
 * Each function returns a DOM element with specified properties
 */

export interface ElementConfig {
	tag: string;
	className?: string;
	id?: string;
	textContent?: string;
	innerHTML?: string;
	attributes?: Record<string, string>;
	data?: Record<string, string>;
	style?: Partial<CSSStyleDeclaration>;
}

export interface InputConfig extends ElementConfig {
	type?: string;
	value?: string;
	checked?: boolean;
	name?: string;
	placeholder?: string;
	required?: boolean;
	disabled?: boolean;
}

export interface ButtonConfig extends ElementConfig {
	type?: "button" | "submit" | "reset";
	disabled?: boolean;
	onclick?: () => void;
}

export interface FormConfig extends ElementConfig {
	onsubmit?: (e: Event) => void;
}

/**
 * Pure function to create DOM elements with configuration
 */
export function createElement(config: ElementConfig): HTMLElement {
	const element = document.createElement(config.tag);

	if (config.className) element.className = config.className;
	if (config.id) element.id = config.id;
	if (config.textContent) element.textContent = config.textContent;
	if (config.innerHTML) element.innerHTML = config.innerHTML;

	if (config.attributes) {
		Object.entries(config.attributes).forEach(([key, value]) => {
			element.setAttribute(key, value);
		});
	}

	if (config.data) {
		Object.entries(config.data).forEach(([key, value]) => {
			element.setAttribute(`data-${key}`, value);
		});
	}

	if (config.style) {
		Object.assign(element.style, config.style);
	}

	return element;
}

/**
 * Pure function to create input elements
 */
export function createInput(config: InputConfig): HTMLInputElement {
	const input = createElement(config) as HTMLInputElement;

	if (config.type) input.type = config.type;
	if (config.value !== undefined) input.value = config.value;
	if (config.checked !== undefined) input.checked = config.checked;
	if (config.name) input.name = config.name;
	if (config.placeholder) input.placeholder = config.placeholder;
	if (config.required !== undefined) input.required = config.required;
	if (config.disabled !== undefined) input.disabled = config.disabled;

	return input;
}

/**
 * Pure function to create button elements
 */
export function createButton(config: ButtonConfig): HTMLButtonElement {
	const button = createElement(config) as HTMLButtonElement;

	if (config.type) button.type = config.type;
	if (config.disabled !== undefined) button.disabled = config.disabled;
	if (config.onclick) button.onclick = config.onclick;

	return button;
}

/**
 * Pure function to create form elements
 */
export function createForm(config: FormConfig): HTMLFormElement {
	const form = createElement(config) as HTMLFormElement;

	if (config.onsubmit) {
		form.addEventListener("submit", config.onsubmit);
	}

	return form;
}

/**
 * Pure function to create textarea elements
 */
export function createTextarea(
	config: ElementConfig & {
		value?: string;
		rows?: number;
		cols?: number;
		name?: string;
		placeholder?: string;
	}
): HTMLTextAreaElement {
	const textarea = createElement(config) as HTMLTextAreaElement;

	if (config.value !== undefined) textarea.value = config.value;
	if (config.rows) textarea.rows = config.rows;
	if (config.cols) textarea.cols = config.cols;
	if (config.name) textarea.name = config.name;
	if (config.placeholder) textarea.placeholder = config.placeholder;

	return textarea;
}

/**
 * Pure function to create label elements
 */
export function createLabel(
	config: ElementConfig & {
		for?: string;
	}
): HTMLLabelElement {
	const label = createElement(config) as HTMLLabelElement;

	if (config.for) label.setAttribute("for", config.for);

	return label;
}

/**
 * Pure function to append children to a parent element
 */
export function appendChildren(
	parent: HTMLElement,
	children: HTMLElement[]
): HTMLElement {
	children.forEach((child) => parent.appendChild(child));
	return parent;
}

/**
 * Pure function to create a container with children
 */
export function createContainer(
	config: ElementConfig,
	children: HTMLElement[] = []
): HTMLElement {
	const container = createElement(config);
	return appendChildren(container, children);
}
