import { createElement } from "./dom-factory.js";

export type IconName =
	| "alert-circle"
	| "alert-triangle"
	| "check-circle"
	| "file-text"
	| "folder"
	| "help-circle"
	| "info"
	| "lock"
	| "refresh-cw"
	| "save"
	| "tag"
	| "tool"
	| "trash"
	| "x"
	| "x-circle";

export interface IconOptions {
	size?: number;
	className?: string;
	title?: string;
	decorative?: boolean;
	/**
	 * Optional color for the icon. When provided, the icon will render via a CSS mask
	 * so it can be filled with the specified color (and scale crisply). This avoids
	 * the limitations of coloring external <img> SVGs.
	 * Examples: "#1a2b3c", "rgb(0,0,0)", "currentColor".
	 */
	color?: string;
}

export interface IconLabelOptions extends IconOptions {
	containerClassName?: string;
	textClassName?: string;
	iconClassName?: string;
}

export interface IconListOptions extends IconLabelOptions {
	listClassName?: string;
	itemClassName?: string;
}

export interface IconListItem {
	icon: IconName;
	text: string;
}

export function createIcon(
	name: IconName,
	options: IconOptions = {}
): HTMLElement {
	const { size = 20, className, title, decorative = true, color } = options;
	const classes = ["icon", className].filter(Boolean).join(" ");

	const wrapper = createElement({
		tag: "span",
		...(classes ? { className: classes } : {}),
	});

	const iconPath = `styles/icons/${name}.svg`;

	// Heuristic: treat certain icon usages as "button icons" and render via CSS mask so color = currentColor
	const isButtonIcon =
		(className?.includes("btn-icon") ?? false) ||
		(className?.includes("toast-dismiss__icon") ?? false) ||
		(className?.includes("dismiss-btn__icon") ?? false);

	// Use mask rendering if it's a button icon OR a color was explicitly provided
	const useMaskRendering = isButtonIcon || Boolean(color);

	if (useMaskRendering) {
		// Size the wrapper and use mask + background to allow color inheritance from text
		// Standard mask
		// @ts-ignore - maskImage is widely supported but may not exist on the TS DOM type
		wrapper.style.maskImage = `url(${iconPath})`;
		// @ts-ignore
		wrapper.style.maskRepeat = "no-repeat";
		// @ts-ignore
		wrapper.style.maskPosition = "center";
		// @ts-ignore
		wrapper.style.maskSize = "contain";
		// WebKit prefix for Safari
		// @ts-ignore
		wrapper.style.webkitMaskImage = `url(${iconPath})`;
		// @ts-ignore
		wrapper.style.webkitMaskRepeat = "no-repeat";
		// @ts-ignore
		wrapper.style.webkitMaskPosition = "center";
		// @ts-ignore
		wrapper.style.webkitMaskSize = "contain";

		wrapper.style.backgroundColor = color ?? "currentColor";
		wrapper.style.width = `${size}px`;
		wrapper.style.height = `${size}px`;
		wrapper.style.display = "inline-block";

		if (title) {
			wrapper.setAttribute("title", title);
		}
		if (decorative) {
			wrapper.setAttribute("aria-hidden", "true");
		} else {
			wrapper.setAttribute("role", "img");
			wrapper.setAttribute("aria-label", title ?? name.replace(/-/g, " "));
		}

		return wrapper;
	}

	// Default: use img element (keeps existing behavior/tests)
	const img = document.createElement("img");
	img.src = iconPath;
	img.width = size;
	img.height = size;
	img.className = "icon__image";
	if (title) {
		img.title = title;
	}

	if (decorative) {
		img.alt = "";
		img.setAttribute("aria-hidden", "true");
	} else {
		img.alt = title ?? name.replace(/-/g, " ");
	}

	wrapper.appendChild(img);
	return wrapper;
}

export function createIconLabel(
	name: IconName,
	text: string,
	options: IconLabelOptions = {}
): HTMLElement {
	const { containerClassName, textClassName, iconClassName, ...iconOptions } =
		options;

	const containerClasses = ["icon-label", containerClassName]
		.filter(Boolean)
		.join(" ");
	const container = createElement({
		tag: "div",
		...(containerClasses ? { className: containerClasses } : {}),
	});

	const iconClasses = ["icon-label__icon", iconClassName]
		.filter(Boolean)
		.join(" ");
	container.appendChild(
		createIcon(name, {
			...iconOptions,
			...(iconClasses ? { className: iconClasses } : {}),
		})
	);

	const textClasses = ["icon-label__text", textClassName]
		.filter(Boolean)
		.join(" ");
	const textElement = createElement({
		tag: "span",
		...(textClasses ? { className: textClasses } : {}),
		textContent: text,
	});
	container.appendChild(textElement);

	return container;
}

export function createIconList(
	items: IconListItem[],
	options: IconListOptions = {}
): HTMLElement {
	const { listClassName, itemClassName, ...labelOptions } = options;
	const listClasses = ["icon-list", listClassName].filter(Boolean).join(" ");
	const list = createElement({
		tag: "div",
		...(listClasses ? { className: listClasses } : {}),
	});

	items.forEach((item) => {
		const itemClasses = [
			"icon-list__item",
			itemClassName,
			labelOptions.containerClassName,
		]
			.filter(Boolean)
			.join(" ");

		list.appendChild(
			createIconLabel(item.icon, item.text, {
				...labelOptions,
				...(itemClasses ? { containerClassName: itemClasses } : {}),
			})
		);
	});

	return list;
}
