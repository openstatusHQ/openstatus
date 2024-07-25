"use client";

import { Check, ChevronsUpDown, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";

import type { Workspace } from "@openstatus/db/src/schema";
import { Button } from "@openstatus/ui/src/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@openstatus/ui/src/components/dropdown-menu";
import { Skeleton } from "@openstatus/ui/src/components/skeleton";

import { api } from "@/trpc/client";

export function SelectWorkspace() {
  const [workspaces, setWorkspaces] = React.useState<Workspace[]>([]);
  const [active, setActive] = React.useState<string>();
  const pathname = usePathname();

  React.useEffect(() => {
    if (pathname?.split("/")?.[2] && workspaces.length > 0) {
      setActive(pathname?.split("/")?.[2]);
    }
  }, [pathname, workspaces]);

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
          variant="ghost"
          className="flex w-full items-center justify-between"
        >
          {active ? (
            <span className="truncate">{active}</span>
          ) : (
            <Skeleton className="h-5 w-full" />
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        style={{ width: "var(--radix-dropdown-menu-trigger-width)" }}
      >
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {workspaces.map((workspace) => (
          <DropdownMenuItem key={workspace.id} asChild>
            <a
              href={`/app/${workspace.slug}/monitors`}
              className="justify-between"
            >
              <span className="truncate">{workspace.slug}</span>
              {active === workspace.slug ? (
                <Check className="ml-2 h-4 w-4" />
              ) : null}
            </a>
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
