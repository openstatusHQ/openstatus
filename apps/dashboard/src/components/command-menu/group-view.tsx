"use client";

import {
  CommandGroup,
  CommandItem,
} from "@openstatus/ui/components/ui/command";

import type { CommandAction, CommandMenuGroup } from "./types";

export function GroupView({
  group,
  search,
  onAction,
}: {
  group: CommandMenuGroup;
  search: string;
  onAction: (action: CommandAction) => void;
}) {
  if (group.items.length === 0) return null;
  const items =
    !search && group.idleLimit
      ? group.items.slice(0, group.idleLimit)
      : group.items;
  return (
    <CommandGroup heading={group.heading}>
      {items.map((item) => (
        <CommandItem
          key={item.value}
          value={item.value}
          keywords={item.keywords}
          onSelect={() => onAction(item.action)}
        >
          {item.icon ? <item.icon /> : null}
          {item.description ? (
            <div className="grid min-w-0">
              <span className="truncate">{item.label}</span>
              <span className="text-muted-foreground font-commit-mono truncate text-xs">
                {item.description}
              </span>
            </div>
          ) : (
            <span>{item.label}</span>
          )}
        </CommandItem>
      ))}
    </CommandGroup>
  );
}
