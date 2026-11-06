import { cn } from "@openstatus/ui/lib/utils";
import Link from "next/link";
import type React from "react";

import { ServiceStatusLabel } from "./external-service-pill";
import { statusHref } from "./status-href";
import { STATUS_LETTERS } from "./status-index";

export type ServiceItem = {
  slug: string;
  name: string;
  indicator: string;
  status: string;
  statusMessage: string;
  escalated: boolean;
};

// Cells draw their own right/bottom edge, so a short last row leaves blank
// space instead of a filled block.
export const TILE_GRID =
  "border-border grid border-t border-l [&>*]:border-border [&>*]:border-r [&>*]:border-b";
const TILE_LINK =
  "hover:bg-muted! no-underline! transition-colors duration-150 motion-reduce:transition-none";

export function StatusSection({
  id,
  title,
  count,
  aside,
  children,
}: {
  id: string;
  title: string;
  count?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="not-prose flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2
          id={id}
          className="text-foreground m-0! border-t-0! pt-0! text-base font-semibold"
        >
          {title}
          {count ? (
            <span className="text-muted-foreground ml-2 font-normal tabular-nums">
              {count}
            </span>
          ) : null}
        </h2>
        {aside ? (
          <span className="text-muted-foreground text-sm">{aside}</span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function IssueList({ services }: { services: ServiceItem[] }) {
  return (
    <div className={cn(TILE_GRID, "grid-cols-1")}>
      {services.map((s) => (
        <Link
          key={s.slug}
          href={`/status/${s.slug}`}
          className={cn(
            TILE_LINK,
            "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-0.5 px-3 py-2 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto]",
          )}
        >
          <span className="text-foreground truncate font-medium">{s.name}</span>
          <span className="text-muted-foreground order-last col-span-2 truncate text-sm sm:order-none sm:col-span-1">
            {s.statusMessage}
          </span>
          <ServiceStatusLabel
            indicator={s.indicator}
            status={s.status}
            escalated={s.escalated}
          />
        </Link>
      ))}
    </div>
  );
}

export function PopularGrid({ services }: { services: ServiceItem[] }) {
  return (
    <div className={cn(TILE_GRID, "grid-cols-2 sm:grid-cols-4")}>
      {services.map((s) => (
        <Link
          key={s.slug}
          href={`/status/${s.slug}`}
          className={cn(TILE_LINK, "flex flex-col gap-1 p-3")}
        >
          <span className="text-foreground truncate font-medium">{s.name}</span>
          <ServiceStatusLabel
            indicator={s.indicator}
            status={s.status}
            escalated={s.escalated}
          />
        </Link>
      ))}
    </div>
  );
}

export function ServiceList({ services }: { services: ServiceItem[] }) {
  return (
    <div className={cn(TILE_GRID, "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3")}>
      {services.map((s) => (
        <Link
          key={s.slug}
          href={`/status/${s.slug}`}
          className={cn(
            TILE_LINK,
            "flex items-center justify-between gap-3 px-3 py-2",
          )}
        >
          <span className="text-foreground truncate">{s.name}</span>
          <ServiceStatusLabel
            indicator={s.indicator}
            status={s.status}
            escalated={s.escalated}
            quietWhenOk
          />
        </Link>
      ))}
    </div>
  );
}

export function LetterNav({ active }: { active: string | null }) {
  const items = [
    { key: null, label: "All" },
    ...STATUS_LETTERS.map((l) => ({
      key: l,
      label: l === "0" ? "#" : l.toUpperCase(),
    })),
  ];
  return (
    <nav
      aria-label="Browse by letter"
      className={cn(
        TILE_GRID,
        "grid-cols-7 text-sm sm:grid-cols-[repeat(28,minmax(0,1fr))]",
      )}
    >
      {items.map((item) => {
        const current = item.key === active;
        return (
          <Link
            key={item.label}
            href={`${statusHref({ letter: item.key })}#all`}
            aria-current={current ? "page" : undefined}
            className={cn(
              TILE_LINK,
              "py-2 text-center",
              current
                ? "bg-foreground! text-background! hover:bg-foreground!"
                : "text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function pageWindow(page: number, pageCount: number): (number | null)[] {
  const pages = new Set([1, pageCount, page - 1, page, page + 1]);
  const sorted = [...pages]
    .filter((p) => p >= 1 && p <= pageCount)
    .sort((a, b) => a - b);
  const out: (number | null)[] = [];
  for (const p of sorted) {
    const prev = out[out.length - 1];
    if (typeof prev === "number" && p - prev > 1) out.push(null);
    out.push(p);
  }
  return out;
}

export function StatusPagination({
  page,
  pageCount,
  q,
  letter,
}: {
  page: number;
  pageCount: number;
  q: string;
  letter: string | null;
}) {
  if (pageCount <= 1) return null;
  const href = (p: number) => `${statusHref({ q, letter, page: p })}#all`;
  return (
    <nav
      aria-label="Pagination"
      className={cn(TILE_GRID, "not-prose grid-cols-[auto_minmax(0,1fr)_auto]")}
    >
      {page > 1 ? (
        <Link
          href={href(page - 1)}
          rel="prev"
          className={cn(TILE_LINK, "px-3 py-2")}
        >
          ← Previous
        </Link>
      ) : (
        <span className="text-muted-foreground px-3 py-2">← Previous</span>
      )}
      <span className="flex flex-wrap items-center justify-center gap-1 px-2 py-1 tabular-nums">
        {pageWindow(page, pageCount).map((p, i) =>
          p === null ? (
            <span key={`gap-${i}`} className="text-muted-foreground px-1">
              …
            </span>
          ) : (
            <Link
              key={p}
              href={href(p)}
              aria-current={p === page ? "page" : undefined}
              className={cn(
                "px-2 py-1 no-underline!",
                p === page
                  ? "bg-foreground text-background"
                  : "text-foreground hover:bg-muted",
              )}
            >
              {p}
            </Link>
          ),
        )}
      </span>
      {page < pageCount ? (
        <Link
          href={href(page + 1)}
          rel="next"
          className={cn(TILE_LINK, "px-3 py-2")}
        >
          Next →
        </Link>
      ) : (
        <span className="text-muted-foreground px-3 py-2">Next →</span>
      )}
    </nav>
  );
}

export function RelatedServices({
  services,
}: {
  services: { slug: string; name: string }[];
}) {
  return (
    <div className={cn(TILE_GRID, "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6")}>
      {services.map((s) => (
        <Link
          key={s.slug}
          href={`/status/${s.slug}`}
          className={cn(TILE_LINK, "text-foreground truncate px-3 py-2")}
        >
          {s.name}
        </Link>
      ))}
    </div>
  );
}

export function AgentHint({ markdownPath }: { markdownPath: string }) {
  return (
    <p className="not-prose text-muted-foreground m-0 text-sm">
      For agents: this page as Markdown at{" "}
      <a
        className="text-foreground underline underline-offset-4"
        href={markdownPath}
      >
        {markdownPath}
      </a>
      .
    </p>
  );
}
