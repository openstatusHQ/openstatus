"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

interface NavTabsProps {
  items: {
    value: string;
    label: string;
    icon: LucideIcon;
    href: string;
  }[];
}

export function NavTabs({ items }: NavTabsProps) {
  const pathname = usePathname();
  const normalizedPath = pathname.replace(/\/+$/, "") || "/";

  return (
    <nav className="sticky top-14 z-10 h-[41px] w-full overflow-x-auto border-b bg-background px-2">
      <ul className="inline-flex h-full items-center gap-1 px-3 text-sm">
        {items.map((item) => {
          const normalizedHref = item.href.replace(/\/+$/, "") || "/";
          const isActive =
            normalizedPath === normalizedHref ||
            normalizedPath.startsWith(`${normalizedHref}/`);
          return (
            <li
              key={item.value}
              className={cn(
                "relative flex h-full items-center",
                isActive &&
                  "after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-foreground",
              )}
            >
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 font-commit-mono tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <item.icon size={16} aria-hidden="true" className="shrink-0" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
