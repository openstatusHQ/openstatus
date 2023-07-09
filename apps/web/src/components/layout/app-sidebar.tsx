"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const sideConfig = [
  {
    title: "Dashboard",
    href: "/app",
  },
  {
    title: "Sites",
    href: "/app/sites",
  },
  {
    title: "Monitor",
    href: "/app/monitor",
  },
  // ...
] as const;

export function AppSidebar() {
  const pathname = usePathname();
  return (
    <ul className="grid gap-1">
      {sideConfig.map(({ title, href }) => {
        return (
          <li key={title} className="w-full">
            <Link
              href={href}
              className={cn(
                "hover:border-border hover:text-foreground group flex w-full items-center rounded-md border border-transparent px-2 py-1",
                pathname === href
                  ? "bg-muted border-border text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {title}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
