import type { IconType } from "@openstatus/icons";

// Shared across lucide + brand icons; keep in sync with the rest of the dashboard.
export type CommandIcon = IconType;

// Context each sheet needs when opened from the palette. Adding a sheet here
// extends both `CommandSheet` and the palette's ActiveSheet handling.
type CommandSheetContext = {
  "status-report": { pageId?: number };
  maintenance: { pageId?: number };
  support: Record<never, never>;
  "status-report-update": { reportId: number };
};

export type CommandSheet = {
  [K in keyof CommandSheetContext]: { sheet: K } & CommandSheetContext[K];
}[keyof CommandSheetContext];

export type CommandPage =
  | { type: "monitor"; id: number; name: string }
  | { type: "status-page"; id: number; title: string };

export function pageLabel(page: CommandPage): string {
  return page.type === "monitor" ? page.name : page.title;
}

export type CommandAction =
  | { type: "navigate"; href: string }
  | { type: "external"; href: string }
  | { type: "sheet"; sheet: CommandSheet }
  | { type: "push"; page: CommandPage }
  | { type: "run"; run: () => void };

export type CommandMenuItem = {
  value: string; // cmdk identity — must stay stable across renders
  label: string;
  description?: string; // muted mono second line
  icon?: CommandIcon;
  keywords?: string[];
  action: CommandAction;
};

export type CommandMenuGroup = {
  heading: string;
  items: CommandMenuItem[];
  // Cap shown items while the search input is empty (root entity groups).
  idleLimit?: number;
};
