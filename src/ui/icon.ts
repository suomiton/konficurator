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

export function createIcon(name: IconName, options: IconOptions = {}): HTMLElement {
        const { size = 20, className, title, decorative = true } = options;
        const classes = ["icon", className].filter(Boolean).join(" ");

        const wrapper = createElement({
                tag: "span",
                ...(classes ? { className: classes } : {}),
        });

        const iconPath = `styles/icons/${name}.svg`;
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
        const { containerClassName, textClassName, iconClassName, ...iconOptions } = options;

        const containerClasses = ["icon-label", containerClassName].filter(Boolean).join(" ");
        const container = createElement({
                tag: "div",
                ...(containerClasses ? { className: containerClasses } : {}),
        });

        const iconClasses = ["icon-label__icon", iconClassName].filter(Boolean).join(" ");
        container.appendChild(
                createIcon(name, {
                        ...iconOptions,
                        ...(iconClasses ? { className: iconClasses } : {}),
                })
        );

        const textClasses = ["icon-label__text", textClassName].filter(Boolean).join(" ");
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
                ].filter(Boolean).join(" ");

                list.appendChild(
                        createIconLabel(item.icon, item.text, {
                                ...labelOptions,
                                ...(itemClasses ? { containerClassName: itemClasses } : {}),
                        })
                );
        });

        return list;
}
