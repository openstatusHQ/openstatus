"use client";

import { Textarea } from "@openstatus/ui/components/ui/textarea";
import { cn } from "@openstatus/ui/lib/utils";
import { type VariantProps, cva } from "class-variance-authority";
import { format } from "date-fns";
import { useState } from "react";

import { HoverCardTimestamp } from "@/components/common/hover-card-timestamp";
import { useHydrated } from "@/hooks/use-hydrated";

export function DetailHeader({
  children,
  className,
  ...props
}: React.ComponentProps<"header">) {
  return (
    <header
      data-slot="detail-header"
      className={cn("flex flex-col gap-3 border-b pb-6", className)}
      {...props}
    >
      {children}
    </header>
  );
}

export function DetailEyebrow({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="detail-eyebrow"
      className={cn("flex min-h-8 flex-wrap items-center gap-2", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function DetailActions({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="detail-actions"
      className={cn("ml-auto flex items-center gap-2", className)}
      {...props}
    >
      {children}
    </div>
  );
}

/** Title on the left, `DetailActions` on the right, on one line. */
export function DetailTitleRow({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="detail-title-row"
      className={cn("flex items-start justify-between gap-4", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function DetailTitle({
  children,
  className,
  ...props
}: React.ComponentProps<"h1">) {
  return (
    <h1
      data-slot="detail-title"
      className={cn(
        "min-w-0 flex-1 text-2xl font-semibold tracking-tight text-balance",
        className,
      )}
      {...props}
    >
      {children}
    </h1>
  );
}

export function DetailDescription({
  children,
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="detail-description"
      className={cn("text-muted-foreground text-pretty", className)}
      {...props}
    >
      {children}
    </p>
  );
}

/** Edit-in-place field for `DetailTitle` / `DetailDescription`; commits on blur. */
export function DetailInput({
  value,
  onCommit,
  multiline = false,
  className,
  ...props
}: Omit<
  React.ComponentProps<typeof Textarea>,
  "value" | "defaultValue" | "onBlur" | "onKeyDown" | "onInput"
> & {
  value: string;
  onCommit: (value: string) => void;
  multiline?: boolean;
}) {
  // Keyed by the server value: a new one resets the draft as it remounts.
  const [draft, setDraft] = useState({ base: value, text: value });
  const text = draft.base === value ? draft.text : value;

  return (
    <span
      data-slot="detail-input"
      className={cn(
        "-mx-2 -my-1 grid w-[calc(100%+1rem)] text-wrap",
        className,
      )}
    >
      {/* Invisible mirror in the same cell sizes the textarea in every browser. */}
      <span
        aria-hidden="true"
        className="invisible col-start-1 row-start-1 border border-transparent px-2 py-1 break-words whitespace-pre-wrap"
      >
        {text}{" "}
      </span>
      <Textarea
        // Uncontrolled: remounting on a new server value drops the stale draft.
        key={value}
        defaultValue={value}
        rows={1}
        onInput={(e) => setDraft({ base: value, text: e.currentTarget.value })}
        className="hover:bg-accent dark:hover:bg-accent/50 placeholder:text-muted-foreground/60 col-start-1 row-start-1 min-h-0 resize-none overflow-hidden border-transparent bg-transparent px-2 py-1 text-[length:inherit] shadow-none md:text-[length:inherit] dark:bg-transparent"
        onBlur={(e) => {
          const next = multiline
            ? e.currentTarget.value.trim()
            : e.currentTarget.value.replace(/\s+/g, " ").trim();
          if (!next && props.required) {
            e.currentTarget.value = value;
            setDraft({ base: value, text: value });
          } else if (next !== value) onCommit(next);
        }}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === "Escape") {
            e.currentTarget.value = value;
            setDraft({ base: value, text: value });
            e.currentTarget.blur();
          } else if (
            e.key === "Enter" &&
            (!multiline || e.metaKey || e.ctrlKey)
          ) {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        {...props}
      />
    </span>
  );
}

export function DetailMeta({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="detail-meta"
      className={cn(
        "text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-sm",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function DetailMetaItem({
  children,
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="detail-meta-item"
      className={cn(
        "not-first:before:text-muted-foreground/50 inline-flex items-center gap-1.5 not-first:before:mr-0.5 not-first:before:content-['·']",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

/** Absolute by default; pass children for a relative or custom label. */
export function DetailMetaTime({
  date,
  children,
  className,
  ...props
}: Omit<React.ComponentProps<"time">, "dateTime"> & { date: Date }) {
  // local-time text differs between server and browser
  const hydrated = useHydrated();
  return (
    <HoverCardTimestamp date={date} side="bottom">
      <time
        data-slot="detail-meta-time"
        dateTime={date.toISOString()}
        // focusable so the hover card opens from the keyboard
        tabIndex={0}
        className={cn(
          "text-foreground focus-visible:ring-ring/50 rounded-sm font-mono outline-none focus-visible:ring-[3px]",
          className,
        )}
        {...props}
      >
        {hydrated ? (children ?? format(date, "LLL dd, HH:mm")) : null}
      </time>
    </HoverCardTimestamp>
  );
}

export function DetailContent({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="detail-content"
      className={cn(
        "grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,1fr)_22rem]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function DetailMain({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="detail-main"
      className={cn("flex min-w-0 flex-col gap-8", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function DetailAside({
  children,
  className,
  ...props
}: React.ComponentProps<"aside">) {
  return (
    <aside
      data-slot="detail-aside"
      className={cn("flex min-w-0 flex-col gap-8", className)}
      {...props}
    >
      {children}
    </aside>
  );
}

export function DetailSection({
  children,
  className,
  ...props
}: React.ComponentProps<"section">) {
  return (
    <section
      data-slot="detail-section"
      className={cn("flex flex-col gap-3", className)}
      {...props}
    >
      {children}
    </section>
  );
}

export function DetailSectionHeader({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="detail-section-header"
      className={cn("flex items-baseline justify-between gap-2", className)}
      {...props}
    >
      {children}
    </div>
  );
}

const detailSectionTitleVariants = cva("", {
  variants: {
    variant: {
      label: "text-muted-foreground text-xs font-light tracking-wide uppercase",
      heading: "text-base font-medium",
    },
  },
  defaultVariants: {
    variant: "label",
  },
});

export function DetailSectionTitle({
  children,
  className,
  variant,
  ...props
}: React.ComponentProps<"h2"> &
  VariantProps<typeof detailSectionTitleVariants>) {
  return (
    <h2
      data-slot="detail-section-title"
      className={cn(detailSectionTitleVariants({ variant }), className)}
      {...props}
    >
      {children}
    </h2>
  );
}
