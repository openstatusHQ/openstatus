"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

import type { Workspace } from "@openstatus/db/src/schema";

import { pagesConfig } from "@/config/pages";
import { cn } from "@/lib/utils";
import { Icons } from "../icons";
import { SelectWorkspace } from "../workspace/select-workspace";

export function AppSidebar() {
  const pathname = usePathname();
  const params = useParams();

  return (
    <div className="flex h-full flex-col justify-between">
      <ul className="grid gap-1">
        {pagesConfig.map(({ title, href, icon, disabled }) => {
          const Icon = Icons[icon];
          const link = `/app/${params?.workspaceSlug}${href}`;
          const isActive = pathname?.startsWith(link);
          return (
            <li key={title} className="w-full">
              <Link
                href={link}
                className={cn(
                  "hover:bg-muted/50 hover:text-foreground text-muted-foreground group flex w-full min-w-[200px] items-center rounded-md border border-transparent px-3 py-1",
                  isActive && "bg-muted/50 border-border text-foreground", // font-semibold
                  disabled && "pointer-events-none opacity-60",
                )}
              >
                <Icon className={cn("mr-2 h-4 w-4")} />
                {title}
              </Link>
            </li>
          );
        })}
      </ul>
      <ul>
        <li className="w-full">
          <SelectWorkspace />
        </li>
      </ul>
    </div>
  );
}
