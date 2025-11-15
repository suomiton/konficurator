import { createElement, createButton, createInput } from "./dom-factory";
import { GroupAccentId, listGroupAccentOptions } from "../theme/groupColors";

export interface GroupOption {
        name: string;
        color?: GroupAccentId;
}

export interface AddFilesDialogResult {
        group: string;
        color?: GroupAccentId; // optional; omitted if unchanged
}

/**
 * Show a lightweight modal to choose existing group or create a new one.
 * Returns null if cancelled.
 */
export function showAddFilesDialog(
	existingGroups: GroupOption[]
): Promise<AddFilesDialogResult | null> {
	return new Promise((resolve) => {
		// Overlay
		const overlay = createElement({
			tag: "div",
			className: "modal-overlay",
		});

		// Dialog
		const dialog = createElement({
			tag: "div",
			className: "modal-dialog",
		});

		const title = createElement({
			tag: "h3",
			textContent: "Add files to a group",
		});

		const groupSelectLabel = createElement({
			tag: "label",
			textContent: "Select existing group:",
		});

		const select = document.createElement("select");
		select.className = "form-control";
		const noneOpt = document.createElement("option");
		noneOpt.value = "";
		noneOpt.textContent = "— None —";
		select.appendChild(noneOpt);
		existingGroups.forEach((g) => {
			const opt = document.createElement("option");
			opt.value = g.name;
			opt.textContent = g.name;
			if (g.color) opt.setAttribute("data-color", g.color);
			select.appendChild(opt);
		});

		const orLabel = createElement({ tag: "div", textContent: "or" });

		const newGroupLabel = createElement({
			tag: "label",
			textContent: "New group name:",
		});
		const newGroupInput = createInput({
			tag: "input",
			className: "form-control",
			type: "text",
			placeholder: "e.g. Staging",
		}) as HTMLInputElement;

                const colorLabel = createElement({
                        tag: "label",
                        textContent: "Group accent (optional):",
                });
                const colorSelect = createAccentSelect();

		const actions = createElement({ tag: "div", className: "modal-actions" });
		const cancelBtn = createButton({
			tag: "button",
			className: "btn",
			type: "button",
			textContent: "Cancel",
		});
		const continueBtn = createButton({
			tag: "button",
			className: "btn btn-primary",
			type: "button",
			textContent: "Continue",
		});

		actions.appendChild(cancelBtn);
		actions.appendChild(continueBtn);

		dialog.appendChild(title);
		dialog.appendChild(groupSelectLabel);
		dialog.appendChild(select);
		dialog.appendChild(orLabel);
		dialog.appendChild(newGroupLabel);
		dialog.appendChild(newGroupInput);
		dialog.appendChild(colorLabel);
                dialog.appendChild(colorSelect);
		dialog.appendChild(actions);

		overlay.appendChild(dialog);
		document.body.appendChild(overlay);

		ensureStyles();

		function close(result: AddFilesDialogResult | null) {
			if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
			resolve(result);
		}

		cancelBtn.addEventListener("click", () => close(null));

		continueBtn.addEventListener("click", () => {
			const selected = select.value.trim();
			const newName = newGroupInput.value.trim();
			const group = newName || selected || "default";

                        let color: GroupAccentId | undefined;
                        if (newName) {
                                color = readAccentValue(colorSelect);
                        } else if (selected) {
                                const opt = select.selectedOptions[0];
                                const accentId = opt?.getAttribute("data-color") || undefined;
                                color = accentId ? (accentId as GroupAccentId) : undefined;
                        }

			const result: any = { group };
			if (color !== undefined) result.color = color;
			close(result as AddFilesDialogResult);
		});

		overlay.addEventListener("click", (e) => {
			if (e.target === overlay) close(null);
		});
	});
}

export type EditGroupDialogResult =
        | { type: "save"; group: string; newName: string; color?: GroupAccentId }
        | { type: "closeAll"; group: string }
        | { type: "remove"; group: string };

/**
 * Show modal to edit a group's name/color or remove/close all files.
 */
export function showEditGroupDialog(group: {
	name: string;
	color?: string;
}): Promise<EditGroupDialogResult | null> {
	return new Promise((resolve) => {
		const overlay = createElement({ tag: "div", className: "modal-overlay" });
		const dialog = createElement({ tag: "div", className: "modal-dialog" });

		const title = createElement({ tag: "h3", textContent: `Edit group` });

		const nameLabel = createElement({
			tag: "label",
			textContent: "Group name:",
		});
		const nameInput = createInput({
			tag: "input",
			className: "form-control",
			type: "text",
			value: group.name,
		}) as HTMLInputElement;

                const colorLabel = createElement({
                        tag: "label",
                        textContent: "Group accent:",
                });
                const colorSelect = createAccentSelect(group.color);

		const actionsPrimary = createElement({
			tag: "div",
			className: "modal-actions",
		});
		const cancelBtn = createButton({
			tag: "button",
			className: "btn",
			type: "button",
			textContent: "Cancel",
		});
		const saveBtn = createButton({
			tag: "button",
			className: "btn btn-primary",
			type: "button",
			textContent: "Save",
		});

		const actionsSecondary = createElement({
			tag: "div",
			className: "modal-actions modal-actions--secondary",
		});
		const closeAllBtn = createButton({
			tag: "button",
			className: "btn btn-warning",
			type: "button",
			textContent: "Close all files",
		});
		const removeBtn = createButton({
			tag: "button",
			className: "btn btn-danger",
			type: "button",
			textContent: "Remove group",
		});

		actionsPrimary.appendChild(cancelBtn);
		actionsPrimary.appendChild(saveBtn);
		actionsSecondary.appendChild(closeAllBtn);
		actionsSecondary.appendChild(removeBtn);

		dialog.appendChild(title);
		dialog.appendChild(nameLabel);
		dialog.appendChild(nameInput);
		dialog.appendChild(colorLabel);
                dialog.appendChild(colorSelect);
		dialog.appendChild(actionsPrimary);
		dialog.appendChild(actionsSecondary);

		overlay.appendChild(dialog);
		document.body.appendChild(overlay);

		ensureStyles();

		function close(result: EditGroupDialogResult | null) {
			if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
			resolve(result);
		}

		cancelBtn.addEventListener("click", () => close(null));
		saveBtn.addEventListener("click", () => {
			const newName = (nameInput.value || "").trim();
                        const color = readAccentValue(colorSelect);
			if (!newName) return close(null);
			const out: any = { type: "save", group: group.name, newName };
			if (color !== undefined) out.color = color;
			close(out as EditGroupDialogResult);
		});
		closeAllBtn.addEventListener("click", () =>
			close({ type: "closeAll", group: group.name })
		);
		removeBtn.addEventListener("click", () =>
			close({ type: "remove", group: group.name })
		);

		overlay.addEventListener("click", (e) => {
			if (e.target === overlay) close(null);
		});
	});
}

function ensureStyles() {
        if (document.getElementById("group-dialog-styles")) return;
        const style = document.createElement("style");
        style.id = "group-dialog-styles";
        style.textContent = `
  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display:flex; align-items:center; justify-content:center; z-index:10000; }
  .modal-dialog { background: #fff; border-radius: 8px; padding: 16px; width: 380px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
  .modal-dialog h3 { margin-top: 0; margin-bottom: 12px; }
  .modal-dialog label { display:block; font-weight:600; margin-top: 8px; margin-bottom: 4px; }
  .modal-dialog .form-control { width: 100%; box-sizing: border-box; padding: 8px; border-radius: 6px; border: 1px solid #ddd; }
  .modal-actions { display:flex; justify-content:flex-end; gap: 8px; margin-top: 16px; }
  .btn { background:#e5e7eb; border:none; padding:8px 12px; border-radius:6px; cursor:pointer; }
  .btn-primary { background:#4f46e5; color:white; }
  `;
        document.head.appendChild(style);
}

function createAccentSelect(initial?: GroupAccentId): HTMLSelectElement {
        const select = document.createElement("select");
        select.className = "form-control";
        const blank = document.createElement("option");
        blank.value = "";
        blank.textContent = "Use default accent";
        select.appendChild(blank);
        listGroupAccentOptions().forEach((accent) => {
                const option = document.createElement("option");
                option.value = accent.id;
                option.textContent = accent.label;
                option.setAttribute("data-accent-id", accent.id);
                if (accent.id === initial) {
                        option.selected = true;
                }
                select.appendChild(option);
        });
        if (!initial) {
                blank.selected = true;
        }
        return select;
}

function readAccentValue(select: HTMLSelectElement): GroupAccentId | undefined {
        const value = select.value;
        return value ? (value as GroupAccentId) : undefined;
}
