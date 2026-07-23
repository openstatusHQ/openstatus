"use client";

import {
  CommandGroup,
  CommandItem,
} from "@openstatus/ui/components/ui/command";

import { MONITOR_ACTIONS } from "../config";

export function MonitorScope({
  page,
  navigate,
}: {
  page: { id: number; name: string };
  navigate: (href: string) => void;
}) {
  return (
    <CommandGroup heading={page.name}>
      {MONITOR_ACTIONS(page.id).map((item) => (
        <CommandItem
          key={item.href}
          value={item.label}
          keywords={item.keywords}
          onSelect={() => navigate(item.href)}
        >
          <item.icon />
          <span>{item.label}</span>
        </CommandItem>
      ))}
    </CommandGroup>
  );
}
