"use client";

import { useCookieState } from "@openstatus/ui/hooks/use-cookie-state";
import { useState } from "react";

export const NAV_GROUP_AUTO_COLLAPSE_ABOVE = 10;

type StoredState = "true" | "false";
type ActiveId = string | number | undefined;

export function resolveNavGroupOpen({
  stored,
  count,
  hasActiveItem,
}: {
  stored: StoredState | undefined;
  count: number;
  hasActiveItem: boolean;
}) {
  if (hasActiveItem) return true;
  if (stored === undefined) return count <= NAV_GROUP_AUTO_COLLAPSE_ABOVE;
  return stored === "true";
}

export function useNavGroupOpen(
  name: string,
  count: number,
  activeId: ActiveId,
) {
  const [stored, setStored] = useCookieState<StoredState>(
    `sidebar_group_${name}`,
  );
  // A manual toggle wins until the active item changes, so a group holding
  // the current page can still be collapsed.
  const [toggled, setToggled] = useState<{
    activeId: ActiveId;
    open: boolean;
  }>();

  const open =
    toggled && toggled.activeId === activeId
      ? toggled.open
      : resolveNavGroupOpen({
          stored,
          count,
          hasActiveItem: activeId !== undefined,
        });

  const setOpen = (value: boolean) => {
    setToggled({ activeId, open: value });
    setStored(value ? "true" : "false");
  };

  return [open, setOpen] as const;
}
