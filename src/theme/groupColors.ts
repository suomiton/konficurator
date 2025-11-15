export type GroupAccentId =
        | "sky"
        | "blueGreen"
        | "prussian"
        | "yellow"
        | "orange"
        | "teal"
        | "danger"
        | "slate";

export interface GroupAccent {
        id: GroupAccentId;
        label: string;
        cssVar: string;
        hex: string;
}

const GROUP_ACCENTS: GroupAccent[] = [
        { id: "sky", label: "Sky Blue", cssVar: "--color-sky-blue", hex: "#8ecae6" },
        { id: "blueGreen", label: "Blue Green", cssVar: "--color-blue-green", hex: "#219ebc" },
        { id: "prussian", label: "Prussian Blue", cssVar: "--color-prussian-blue", hex: "#023047" },
        { id: "yellow", label: "Selective Yellow", cssVar: "--color-selective-yellow", hex: "#ffb703" },
        { id: "orange", label: "UI Orange", cssVar: "--color-ui-orange", hex: "#fb8500" },
        { id: "teal", label: "Success Teal", cssVar: "--color-success", hex: "#2a9d8f" },
        { id: "danger", label: "Danger Red", cssVar: "--color-danger", hex: "#d62828" },
        { id: "slate", label: "Slate", cssVar: "--color-gray-600", hex: "#868e96" },
];

export const DEFAULT_GROUP_ACCENT: GroupAccentId = "blueGreen";

export function listGroupAccentOptions(): GroupAccent[] {
        return GROUP_ACCENTS.map((accent) => ({ ...accent }));
}

export function getAccentById(id: GroupAccentId): GroupAccent {
        const match = GROUP_ACCENTS.find((accent) => accent.id === id);
        if (!match) {
                throw new Error(`Unknown group accent: ${id}`);
        }
        return match;
}

export function getAccentCssValue(id?: GroupAccentId): string | undefined {
        if (!id) return undefined;
        const accent = GROUP_ACCENTS.find((candidate) => candidate.id === id);
        return accent ? `var(${accent.cssVar})` : undefined;
}

export function normalizeGroupAccent(value?: string | null): GroupAccentId | undefined {
        if (!value) return undefined;
        const trimmed = value.trim();
        if (!trimmed) return undefined;

        const byId = GROUP_ACCENTS.find((accent) => accent.id === trimmed);
        if (byId) return byId.id;

        const byCssVar = GROUP_ACCENTS.find(
                (accent) => `var(${accent.cssVar})` === trimmed
        );
        if (byCssVar) return byCssVar.id;

        const lower = trimmed.toLowerCase();
        const byHex = GROUP_ACCENTS.find((accent) => accent.hex.toLowerCase() === lower);
        return byHex?.id;
}
