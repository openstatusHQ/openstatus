"use client";

import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@openstatus/ui/components/ui/sheet";
import { ChevronRight, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { type DocsNavSection, docsNav, isExternalItem } from "./docs.config";

function NavSection({
  section,
  pathname,
  onNavigate,
}: {
  section: DocsNavSection;
  pathname: string;
  onNavigate?: () => void;
}) {
  const containsActive = section.items.some(
    (item) => !isExternalItem(item) && pathname === `/docs/${item.slug}`,
  );
  const [open, setOpen] = useState(!section.collapsed || containsActive);

  // Auto-expand the section when navigating into one of its pages.
  useEffect(() => {
    if (containsActive) setOpen(true);
  }, [containsActive]);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between py-1 font-medium text-foreground hover:bg-muted"
      >
        {section.label}
        <ChevronRight
          className={cn("size-4 transition-transform", open && "rotate-90")}
        />
      </button>
      {open ? (
        <ul>
          {section.items.map((item) => {
            if (isExternalItem(item)) {
              return (
                <li key={item.link}>
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block py-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    {item.label}
                  </a>
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
                    "block py-0.5 text-muted-foreground hover:bg-muted hover:text-foreground",
                    active && "bg-muted text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
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
    <nav aria-label="Docs" className="flex flex-col gap-2 text-sm">
      {docsNav.map((section) => (
        <NavSection
          key={section.label}
          section={section}
          pathname={pathname}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  );
}

export function DocsSidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  return (
    <aside className={className}>
      <div className="sticky top-4">
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
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger className="mb-4 flex items-center gap-2 border border-border px-3 py-2 text-sm hover:bg-muted">
          <Menu className="size-4" />
          Docs menu
        </SheetTrigger>
        <SheetContent
          side="left"
          className="gap-0 rounded-none p-0 font-mono sm:w-96"
        >
          <SheetTitle className="border-border border-b p-4 font-medium">
            Documentation
          </SheetTitle>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <NavTree pathname={pathname} onNavigate={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
