export const VIEW_KEYS = ["visao-geral", "lista", "quadro", "calendario"] as const;
export type ViewKey = (typeof VIEW_KEYS)[number];
