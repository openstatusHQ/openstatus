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

export function SelectWorkspace({ workspaces }: { workspaces: Workspace[] }) {
  const [active, setActive] = React.useState<string>();
  const pathname = usePathname();

  React.useEffect(() => {
    if (pathname?.split("/")?.[2]) {
      setActive(pathname?.split("/")?.[2]);
    }
  }, [pathname]);

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
              if (workspace.slug !== active) {
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
