import { FileData } from "../interfaces";
import { GroupAccentId } from "../theme/groupColors";
import { createElement } from "./dom-factory";

export interface FileListViewOptions {
        containerId?: string;
        onToggleFile: (fileId: string) => void;
}

export class FileListView {
        private readonly containerId: string;
        private readonly onToggleFile: (fileId: string) => void;

        constructor(options: FileListViewOptions) {
                this.containerId = options.containerId ?? "fileInfo";
                this.onToggleFile = options.onToggleFile;
        }

        render(files: FileData[], groupColors: Map<string, GroupAccentId>): void {
                const fileInfo = document.getElementById(this.containerId);
                if (!fileInfo) return;

                const listContainer = this.ensureListContainer(fileInfo);
                const fileList = createElement({ tag: "div", className: "file-list" });

                const groups = this.groupByName(files);
                groups.forEach((groupFiles, groupName) => {
                        const accent = groupColors.get(groupName) || groupFiles[0]?.groupColor;

                        const groupContainer = createElement({
                                tag: "div",
                                className: "file-group",
                        });
                        if (accent) {
                                groupContainer.setAttribute("data-accent", accent);
                        } else {
                                groupContainer.removeAttribute("data-accent");
                        }

                        const header = createElement({
                                tag: "div",
                                className: "file-group-header",
                        });
                        const title = createElement({
                                tag: "button",
                                className: "file-group-title",
                                textContent: groupName,
                                attributes: { type: "button", "data-group": groupName },
                        });
                        header.appendChild(title);

                        const groupList = createElement({
                                tag: "div",
                                className: "file-group-list",
                        });

                        groupFiles.forEach((file) => {
                                const fileTag = createElement({
                                        tag: "span",
                                        className: "file-tag",
                                        attributes: { "data-id": file.id },
                                });
                                if (file.isActive === false) fileTag.classList.add("inactive");
                                if (accent) {
                                        fileTag.setAttribute("data-accent", accent);
                                } else {
                                        fileTag.removeAttribute("data-accent");
                                }
                                fileTag.textContent = file.name;
                                const baseTooltip = file.handle
                                        ? "File loaded from disk - can be refreshed"
                                        : "File restored from storage - use reload button to get latest version";
                                fileTag.title = `${baseTooltip}. Click to ${
                                        file.isActive === false ? "show" : "hide"
                                } editor.`;
                                fileTag.addEventListener("click", () => this.onToggleFile(file.id));
                                groupList.appendChild(fileTag);
                        });

                        groupContainer.appendChild(header);
                        groupContainer.appendChild(groupList);
                        fileList.appendChild(groupContainer);
                });

                const addTag = createElement({
                        tag: "button",
                        className: "file-tag add-file-tag",
                        textContent: "+ Add",
                        attributes: {
                                id: "selectFiles",
                                type: "button",
                                title: "Add configuration file",
                        },
                });
                fileList.appendChild(addTag);

                listContainer.innerHTML = "";
                listContainer.appendChild(fileList);
                fileInfo.classList.add("visible");
        }

        private ensureListContainer(parent: HTMLElement): HTMLElement {
                let listContainer = parent.querySelector<HTMLElement>("#fileInfoListContainer");
                if (!listContainer) {
                        listContainer = createElement({
                                tag: "div",
                                className: "file-list-container",
                                attributes: { id: "fileInfoListContainer" },
                        });
                        parent.appendChild(listContainer);
                }
                return listContainer;
        }

        private groupByName(files: FileData[]): Map<string, FileData[]> {
                const groups = new Map<string, FileData[]>();
                files.forEach((file) => {
                        const current = groups.get(file.group) ?? [];
                        current.push(file);
                        groups.set(file.group, current);
                });
                return groups;
        }
}
