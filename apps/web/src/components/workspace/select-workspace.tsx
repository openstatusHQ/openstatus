"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, ChevronsUpDown, Plus } from "lucide-react";

import type { Workspace } from "@openstatus/db/src/schema";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Skeleton,
} from "@openstatus/ui";

import { api } from "@/trpc/client";

export function SelectWorkspace() {
  const [workspaces, setWorkspaces] = React.useState<Workspace[]>([]);
  const [active, setActive] = React.useState<string>();
  const pathname = usePathname();

  // biome-ignore lint/correctness/useExhaustiveDependencies:
  React.useEffect(() => {
    if (pathname?.split("/")?.[2] && workspaces.length > 0) {
      setActive(pathname?.split("/")?.[2]);
    }
  }, [pathname, workspaces]);

  // biome-ignore lint/correctness/useExhaustiveDependencies:
  React.useEffect(() => {
    // REMINDER: avoid prop drilling to get data from the layout.tsx component. instead use client trpc
    async function fetchWorkspaces() {
      const _workspaces = await api.workspace.getUserWorkspaces.query();
      setWorkspaces(_workspaces);
    }
    fetchWorkspaces();
  }, []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="flex w-full items-center justify-between"
        >
          {active ? <span>{active}</span> : <Skeleton className="h-5 w-full" />}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)]">
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {workspaces.map((workspace) => (
          <DropdownMenuItem
            key={workspace.id}
            onClick={() => {
              if (workspace.slug !== active && typeof window !== "undefined") {
                window.location.href = `/app/${workspace.slug}/monitors`;
              }
            }}
            className="justify-between"
          >
            {workspace.slug}
            {active === workspace.slug ? (
              <Check className="ml-2 h-4 w-4" />
            ) : null}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link
            href={`/app/${active}/settings/team`}
            className="flex items-center justify-between"
          >
            Invite Members
            <Plus className="ml-2 h-4 w-4" />
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
