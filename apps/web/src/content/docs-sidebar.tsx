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

// ─── Option A: Current (baseline) ───────────────────────────────────────────

function NavSectionA({
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
        className="flex w-full items-center justify-between px-2 py-2 text-foreground transition-colors duration-150 ease hover:bg-muted motion-reduce:transition-none"
      >
        <span className="font-medium">{section.label}</span>
        <ChevronRight
          className={cn(
            "size-4 text-muted-foreground transition-transform duration-150 ease-out motion-reduce:transition-none",
            open && "rotate-90",
          )}
        />
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
                    className="block px-2 py-2 text-muted-foreground transition-colors duration-150 ease hover:bg-muted hover:text-foreground motion-reduce:transition-none"
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
                    "block px-2 py-2 text-muted-foreground transition-colors duration-150 ease hover:bg-muted hover:text-foreground motion-reduce:transition-none",
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

function NavTreeA({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Docs" className="flex flex-col gap-1 text-sm">
      {docsNav.map((section) => (
        <NavSectionA
          key={section.label}
          section={section}
          pathname={pathname}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  );
}

// ─── Option B: Padded + left border indicator ───────────────────────────────

function NavSectionB({
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
        className="flex w-full items-center justify-between py-2 text-foreground transition-colors duration-150 ease motion-reduce:transition-none hover:text-foreground/70"
      >
        <span className="font-medium">{section.label}</span>
        <ChevronRight
          className={cn(
            "size-3.5 text-muted-foreground transition-transform duration-150 ease-out motion-reduce:transition-none",
            open && "rotate-90",
          )}
        />
      </button>
      <CollapsibleList open={open}>
        <ul className="ml-0.5 border-l border-border">
          {section.items.map((item) => {
            if (isExternalItem(item)) {
              return (
                <li key={item.link}>
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block py-2 pl-3 text-muted-foreground transition-colors duration-150 ease hover:text-foreground motion-reduce:transition-none"
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
                    "-ml-px block border-l border-transparent py-2 pl-3 text-muted-foreground transition-colors duration-150 ease hover:border-foreground/30 hover:text-foreground motion-reduce:transition-none",
                    active && "border-foreground text-foreground",
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

function NavTreeB({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Docs" className="flex flex-col gap-1 text-sm">
      {docsNav.map((section) => (
        <NavSectionB
          key={section.label}
          section={section}
          pathname={pathname}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  );
}

// ─── Option C: Muted background active + rounded pill ───────────────────────

function NavSectionC({
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
        className="flex w-full items-center justify-between py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground transition-colors duration-150 ease motion-reduce:transition-none"
      >
        {section.label}
        <ChevronRight
          className={cn(
            "size-3 transition-transform duration-150 ease-out motion-reduce:transition-none",
            open && "rotate-90",
          )}
        />
      </button>
      <CollapsibleList open={open}>
        <ul className="mt-0.5 flex flex-col gap-0.5">
          {section.items.map((item) => {
            if (isExternalItem(item)) {
              return (
                <li key={item.link}>
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block px-2 py-2 text-muted-foreground transition-colors duration-150 ease hover:bg-muted hover:text-foreground motion-reduce:transition-none"
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
                    "block px-2 py-2 text-muted-foreground transition-colors duration-150 ease hover:bg-muted hover:text-foreground motion-reduce:transition-none",
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

function NavTreeC({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Docs" className="flex flex-col gap-2 text-sm">
      {docsNav.map((section) => (
        <NavSectionC
          key={section.label}
          section={section}
          pathname={pathname}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  );
}

// ─── Option D: Indented with subtle background band ─────────────────────────

function NavSectionD({
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
        className="flex w-full items-center justify-between py-2 text-foreground transition-colors duration-150 ease motion-reduce:transition-none hover:text-foreground/70"
      >
        <span className="font-medium">{section.label}</span>
        <ChevronRight
          className={cn(
            "size-3.5 text-muted-foreground transition-transform duration-150 ease-out motion-reduce:transition-none",
            open && "rotate-90",
          )}
        />
      </button>
      <CollapsibleList open={open}>
        <ul className="mt-0.5 flex flex-col">
          {section.items.map((item) => {
            if (isExternalItem(item)) {
              return (
                <li key={item.link}>
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block border-l-2 border-transparent py-2 pl-3 text-muted-foreground transition-colors duration-150 ease hover:text-foreground motion-reduce:transition-none"
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
                    "block border-l-2 border-transparent py-2 pl-3 text-muted-foreground transition-colors duration-150 ease hover:bg-muted/50 hover:text-foreground motion-reduce:transition-none",
                    active && "border-foreground bg-muted/50 text-foreground",
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

function NavTreeD({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Docs" className="flex flex-col gap-1 text-sm">
      {docsNav.map((section) => (
        <NavSectionD
          key={section.label}
          section={section}
          pathname={pathname}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  );
}

// ─── Picker-wrapped exports ─────────────────────────────────────────────────

function NavTreePicker({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <div data-uidotsh-pick="Sidebar style" className="contents">
      <div data-uidotsh-option="Flat (current)" className="contents">
        <NavTreeA pathname={pathname} onNavigate={onNavigate} />
      </div>
      <div
        data-uidotsh-option="Left border indicator"
        className="contents"
        hidden
      >
        <NavTreeB pathname={pathname} onNavigate={onNavigate} />
      </div>
      <div
        data-uidotsh-option="Rounded pill highlight"
        className="contents"
        hidden
      >
        <NavTreeC pathname={pathname} onNavigate={onNavigate} />
      </div>
      <div
        data-uidotsh-option="Indent + background band"
        className="contents"
        hidden
      >
        <NavTreeD pathname={pathname} onNavigate={onNavigate} />
      </div>
    </div>
  );
}

export function DocsSidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  return (
    <aside className={className}>
      <div className="sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
        <NavTreePicker pathname={pathname} />
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
        <SheetTrigger className="mb-4 flex items-center gap-2 border border-border px-3 py-2 text-sm transition-colors duration-150 ease hover:bg-muted motion-reduce:transition-none">
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
            <NavTreePicker
              pathname={pathname}
              onNavigate={() => setOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
