import { Settings, Copy, Delete } from "@openstatus/icons";

import {
  DEFAULT_STATUS_PAGE_BASE_DOMAIN,
  getStatusPageUrl,
} from "@/lib/deployment-config";

/** An open report first, then by title. */
export function compareStatusPages(
  a: { title: string; hasActiveStatusReport: boolean },
  b: { title: string; hasActiveStatusReport: boolean },
): number {
  return (
    Number(b.hasActiveStatusReport) - Number(a.hasActiveStatusReport) ||
    a.title.localeCompare(b.title)
  );
}

/**
 * `baseDomain` is the runtime `STATUS_PAGE_BASE_DOMAIN` — client components get
 * it from `useStatusPageBaseDomain()`.
 */
export function getPageUrl(
  page: {
    slug: string;
    customDomain: string | null;
  },
  baseDomain: string = DEFAULT_STATUS_PAGE_BASE_DOMAIN,
): string {
  return getStatusPageUrl(page, baseDomain);
}

export const actions = [
  {
    id: "edit",
    label: "Settings",
    icon: Settings,
    variant: "default" as const,
  },
  {
    id: "copy-id",
    label: "Copy ID",
    icon: Copy,
    variant: "default" as const,
  },
  // {
  //   id: "create-badge",
  //   label: "Create Badge",
  //   icon: Tag,
  //   variant: "default" as const,
  // },
  {
    id: "delete",
    label: "Delete",
    icon: Delete,
    variant: "destructive" as const,
  },
] as const;

export type StatusPageAction = (typeof actions)[number];

export const getActions = (
  props: Partial<Record<StatusPageAction["id"], () => Promise<void> | void>>,
): (StatusPageAction & { onClick?: () => Promise<void> | void })[] => {
  return actions.map((action) => ({
    ...action,
    onClick: props[action.id as keyof typeof props],
  }));
};
