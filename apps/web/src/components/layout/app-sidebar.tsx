"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { pagesConfig } from "@/config/pages";
import { cn } from "@/lib/utils";
import { Icons } from "../icons";

export function AppSidebar() {
  const pathname = usePathname();
  return (
    <ul className="grid gap-1">
      {pagesConfig.map(({ title, href, icon, disabled }) => {
        const Icon = Icons[icon];
        return (
          <li key={title} className="w-full">
            <Link
              href={href}
              className={cn(
                "hover:bg-muted/50 hover:text-foreground text-muted-foreground group -mx-2 flex w-full min-w-[200px] items-center rounded-md border border-transparent px-3 py-1",
                pathname === href &&
                  "bg-muted/50 border-border text-foreground",
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
  );
}
