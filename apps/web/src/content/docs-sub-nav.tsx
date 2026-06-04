"use client";

import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";
import { CopyDropdownButton } from "./copy-button";

function capitalize(str: string) {
  return str
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ─── Option A: Pipe separator (current) ─────────────────────────────────────

function BreadcrumbA({ segments }: { segments: string[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex items-center gap-1 text-sm text-muted-foreground">
        {segments.map((segment, index) => (
          <Fragment key={segment}>
            <li>
              <Link
                href={`/${segments.slice(0, index + 1).join("/")}`}
                className="py-1 transition-colors duration-150 ease hover:text-foreground motion-reduce:transition-none"
              >
                {capitalize(segment)}
              </Link>
            </li>
            {index < segments.length - 1 ? (
              <li aria-hidden>
                <span className="text-muted-foreground/40">|</span>
              </li>
            ) : null}
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}

// ─── Option B: Chevron separator with current page ──────────────────────────

function BreadcrumbB({
  segments,
  currentPage,
}: { segments: string[]; currentPage: string }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex items-center gap-1 text-sm text-muted-foreground">
        {segments.map((segment, index) => (
          <Fragment key={segment}>
            <li>
              <Link
                href={`/${segments.slice(0, index + 1).join("/")}`}
                className="py-1 transition-colors duration-150 ease hover:text-foreground motion-reduce:transition-none"
              >
                {capitalize(segment)}
              </Link>
            </li>
            <li aria-hidden>
              <ChevronRight className="size-3 text-muted-foreground/50" />
            </li>
          </Fragment>
        ))}
        <li>
          <span className="py-1 text-foreground">{currentPage}</span>
        </li>
      </ol>
    </nav>
  );
}

// ─── Option C: Slash separator with current page ────────────────────────────

function BreadcrumbC({
  segments,
  currentPage,
}: { segments: string[]; currentPage: string }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex items-center gap-1.5 text-sm text-muted-foreground">
        {segments.map((segment, index) => (
          <Fragment key={segment}>
            <li>
              <Link
                href={`/${segments.slice(0, index + 1).join("/")}`}
                className="py-1 transition-colors duration-150 ease hover:text-foreground motion-reduce:transition-none"
              >
                {capitalize(segment)}
              </Link>
            </li>
            <li aria-hidden>
              <span className="text-muted-foreground/40">/</span>
            </li>
          </Fragment>
        ))}
        <li>
          <span className="py-1 text-foreground">{currentPage}</span>
        </li>
      </ol>
    </nav>
  );
}

// ─── Option D: Minimal path ─────────────────────────────────────────────────

function BreadcrumbD({
  segments,
  currentPage,
}: { segments: string[]; currentPage: string }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex items-baseline gap-1.5 text-sm">
        {segments.map((segment, index) => (
          <Fragment key={segment}>
            <li>
              <Link
                href={`/${segments.slice(0, index + 1).join("/")}`}
                className="py-1 text-muted-foreground/50 transition-colors duration-150 ease hover:text-foreground motion-reduce:transition-none"
              >
                {capitalize(segment)}
              </Link>
            </li>
            <li aria-hidden>
              <span className="text-muted-foreground/30">/</span>
            </li>
          </Fragment>
        ))}
        <li>
          <span className="py-1 text-foreground">{currentPage}</span>
        </li>
      </ol>
    </nav>
  );
}

// ─── Picker-wrapped export ──────────────────────────────────────────────────

export function DocsSubNav({
  className,
  title,
  ...props
}: React.ComponentProps<"div"> & { title?: string }) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean).slice(0, -1);
  const currentPage = title || capitalize(
    pathname.split("/").filter(Boolean).pop() ?? "",
  );

  return (
    <div
      className={cn("flex items-center justify-between gap-2", className)}
      {...props}
    >
      <div data-uidotsh-pick="Breadcrumb style" className="contents">
        <div data-uidotsh-option="Pipe (current)" className="contents">
          <BreadcrumbA segments={segments} />
        </div>
        <div
          data-uidotsh-option="Chevron + current page"
          className="contents"
          hidden
        >
          <BreadcrumbB segments={segments} currentPage={currentPage} />
        </div>
        <div
          data-uidotsh-option="Slash + current page"
          className="contents"
          hidden
        >
          <BreadcrumbC segments={segments} currentPage={currentPage} />
        </div>
        <div
          data-uidotsh-option="Minimal path"
          className="contents"
          hidden
        >
          <BreadcrumbD segments={segments} currentPage={currentPage} />
        </div>
      </div>
      <CopyDropdownButton className="p-0" />
    </div>
  );
}
