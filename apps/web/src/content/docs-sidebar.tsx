"use client";

import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@openstatus/ui/components/ui/sheet";
import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { type DocsNavSection, docsNav, isExternalItem } from "./docs.config";

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

  useEffect(() => {
    if (containsActive) setOpen(true);
  }, [containsActive]);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="group ease flex w-full items-center justify-between px-2 py-2 text-foreground transition-colors duration-150 hover:bg-muted motion-reduce:transition-none"
      >
        <span className="font-medium font-mono">{section.label}</span>
        <span
          className={cn(
            "relative top-[1px] shrink-0 origin-center text-[10px] text-muted-foreground transition duration-300 group-hover:text-foreground motion-reduce:transition-none",
            open && "rotate-180 text-foreground",
          )}
          aria-hidden="true"
        >
          ▲
        </span>
      </button>
      <CollapsibleList open={open}>
        <ul>
          {section.items.map((item) => {
            if (isExternalItem(item)) {
              return (
                <li key={item.link}>
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ease block px-2 py-2 text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground motion-reduce:transition-none"
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
                    "ease block px-2 py-2 text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground motion-reduce:transition-none",
                    active && "bg-muted text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </CollapsibleList>
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
    <nav aria-label="Docs" className="flex flex-col gap-1 text-sm">
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
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger className="ease mb-4 font-mono flex items-center gap-2 border border-border px-3 py-2 text-sm transition-colors duration-150 hover:bg-muted motion-reduce:transition-none">
          <Menu className="size-4" />
          Docs menu
        </SheetTrigger>
        <SheetContent
          side="left"
          className="gap-0 rounded-none p-0 font-sans sm:w-96"
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
