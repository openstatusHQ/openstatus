export const pageComponentTypes = ["static", "monitor"] as const;

export type PageComponentType = (typeof pageComponentTypes)[number];
