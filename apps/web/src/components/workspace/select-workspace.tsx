"use client";

import { Check, ChevronsUpDown, Copy, CopyCheck, Plus } from "lucide-react";
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

import { copyToClipboard } from "@/lib/utils";
import { api } from "@/trpc/client";

export function SelectWorkspace() {
  const [workspaces, setWorkspaces] = React.useState<Workspace[]>([]);
  const [active, setActive] = React.useState<string>();
  const pathname = usePathname();
  const [hasCopied, setHasCopied] = React.useState(false);

  React.useEffect(() => {
    if (hasCopied) {
      setTimeout(() => {
        setHasCopied(false);
      }, 2000);
    }
  }, [hasCopied]);

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
              className="group justify-between"
            >
              <span className="truncate">{workspace.slug}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="mx-0.5 hidden h-5 w-5 group-hover:block"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  copyToClipboard(workspace.slug);
                  setHasCopied(true);
                }}
              >
                {!hasCopied ? (
                  <Copy className="h-3 w-3" />
                ) : (
                  <CopyCheck className="h-3 w-3" />
                )}
              </Button>
              {active === workspace.slug ? (
                <Check className="ml-2 h-4 w-4 shrink-0" />
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
