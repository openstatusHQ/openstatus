"use client";

import { Menu } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger,
} from "@openstatus/ui/components/ui/drawer";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { cn } from "../lib/utils";
import {
  type DocsNavGroup,
  type DocsNavItem,
  docsNav,
  isExternalItem,
  isGroupItem,
} from "./docs.config";

// A group header and its direct pages share one indent level; descending into a
// nested chapter steps in by one. Top sections and their pages stay flat at 0.
const rowIndent = (depth: number) => ({
  paddingLeft: `${0.5 + depth * 0.75}rem`,
});

function groupContainsActive(group: DocsNavGroup, pathname: string): boolean {
  return group.items.some((item) => {
    if (isExternalItem(item)) return false;
    if (isGroupItem(item)) return groupContainsActive(item, pathname);
    return pathname === `/docs/${item.slug}`;
  });
}

function CollapsibleList({
  open,
  children,
  className,
}: {
  open: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
        open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
      )}
    >
      <div className={cn("overflow-hidden", className)}>{children}</div>
    </div>
  );
}

// A collapsible group — used identically for top-level sections and nested
// chapters; only the indent depth differs.
function NavGroup({
  group,
  pathname,
  onNavigate,
  depth,
}: {
  group: DocsNavGroup;
  pathname: string;
  onNavigate?: () => void;
  depth: number;
}) {
  const containsActive = groupContainsActive(group, pathname);
  const [open, setOpen] = useState(!group.collapsed || containsActive);

  useEffect(() => {
    if (containsActive) setOpen(true);
  }, [containsActive]);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="group ease text-foreground hover:bg-muted flex w-full items-center justify-between py-2 pr-2 transition-colors duration-150 motion-reduce:transition-none"
        style={rowIndent(depth)}
      >
        <span className="font-mono font-medium">{group.label}</span>
        <span
          className={cn(
            "text-muted-foreground group-hover:text-foreground relative top-[1px] shrink-0 origin-center text-[10px] transition duration-300 motion-reduce:transition-none",
            open && "text-foreground rotate-180",
          )}
          aria-hidden="true"
        >
          ▲
        </span>
      </button>
      <CollapsibleList open={open}>
        <NavItems
          items={group.items}
          pathname={pathname}
          onNavigate={onNavigate}
          depth={depth}
        />
      </CollapsibleList>
    </div>
  );
}

function NavItems({
  items,
  pathname,
  onNavigate,
  depth,
}: {
  items: DocsNavItem[];
  pathname: string;
  onNavigate?: () => void;
  depth: number;
}) {
  return (
    <ul>
      {items.map((item) => {
        if (isExternalItem(item)) {
          return (
            <li key={item.link}>
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="ease text-muted-foreground hover:bg-muted hover:text-foreground block py-2 pr-2 transition-colors duration-150 motion-reduce:transition-none"
                style={rowIndent(depth)}
              >
                {item.label}
              </a>
            </li>
          );
        }
        if (isGroupItem(item)) {
          return (
            <li key={item.label}>
              <NavGroup
                group={item}
                pathname={pathname}
                onNavigate={onNavigate}
                depth={depth + 1}
              />
            </li>
          );
        }
        const href = `/docs/${item.slug}`;
        const active = pathname === href;
        return (
          <li key={item.slug}>
            <Link
              href={href}
              onClick={onNavigate}
              className={cn(
                "ease text-muted-foreground hover:bg-muted hover:text-foreground block py-2 pr-2 transition-colors duration-150 motion-reduce:transition-none",
                active && "bg-muted text-foreground",
              )}
              style={rowIndent(depth)}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function NavTree({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Docs" className="flex flex-col gap-1 text-sm">
      {docsNav.map((section) => (
        <NavGroup
          key={section.label}
          group={section}
          pathname={pathname}
          onNavigate={onNavigate}
          depth={0}
        />
      ))}
    </nav>
  );
}

export function DocsSidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  return (
    <aside className={className}>
      <div className="sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
        <NavTree pathname={pathname} />
      </div>
    </aside>
  );
}

export function DocsMobileNav({ className }: { className?: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <div className={className}>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger
          aria-label="Open docs menu"
          className="fixed right-4 bottom-4 z-40"
          asChild
        >
          <Button className="h-auto rounded-none py-3 font-mono has-[>svg]:px-4">
            <Menu className="size-4" />
            Menu
          </Button>
        </DrawerTrigger>
        <DrawerContent className="rounded-none! font-sans">
          <DrawerTitle className="border-border border-b p-4 font-medium">
            Documentation
          </DrawerTitle>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <NavTree pathname={pathname} onNavigate={() => setOpen(false)} />
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
