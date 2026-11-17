"use client";

import { Add } from "@openstatus/icons";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@openstatus/ui/components/ui/hover-card";
import { useSidebar } from "@openstatus/ui/components/ui/sidebar";
import { type VariantProps, cva } from "class-variance-authority";
import { Command as CommandPrimitive, defaultFilter } from "cmdk";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState } from "react";

import { StatusDot, type StatusVariant } from "@/components/common/status-dot";
import { cn } from "@/lib/utils";

type NavPeekState = {
  setFocus: (focused: boolean) => void;
  /** the next hover opens it again */
  close: () => void;
  /** stays closed until the pointer leaves the trigger */
  dismiss: () => void;
  setDismissed: (dismissed: boolean) => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  inputRef: React.RefObject<HTMLInputElement | null>;
  /** focused instead of the search when there is nothing to search */
  rootRef: React.RefObject<HTMLDivElement | null>;
};

// scores 0 for any search, so cmdk's sort always leaves the create row last
const CREATE_VALUE = "nav-peek-create";
const filter: typeof defaultFilter = (value, search, keywords) =>
  value === CREATE_VALUE ? 0 : defaultFilter(value, search, keywords);

const NavPeekContext = createContext<NavPeekState | null>(null);

function useNavPeek() {
  const ctx = useContext(NavPeekContext);
  if (!ctx) throw new Error("NavPeek parts must be inside <NavPeek>");
  return ctx;
}

/** A hover card beside a sidebar item listing its entities as a cmdk combobox. */
export function NavPeek({ children }: { children: React.ReactNode }) {
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();
  const close = () => {
    setHover(false);
    setFocus(false);
  };
  const dismiss = () => {
    setDismissed(true);
    close();
  };
  // a navigation never leaves the card open behind, nor dismissed for good
  useEffect(() => {
    setHover(false);
    setFocus(false);
    setDismissed(false);
  }, [pathname]);
  return (
    <NavPeekContext.Provider
      value={{
        setFocus,
        close,
        dismiss,
        setDismissed,
        triggerRef,
        inputRef,
        rootRef,
      }}
    >
      {/* stays open while focus is inside, so typing in the search never closes it */}
      <HoverCard
        open={!dismissed && (hover || focus)}
        onOpenChange={setHover}
        // opens at once like the sidebar tooltips; the close delay lets the
        // pointer travel from the item into the card
        openDelay={0}
        closeDelay={150}
      >
        {children}
      </HoverCard>
    </NavPeekContext.Provider>
  );
}

/**
 * Clicking navigates and keeps the card closed until the pointer leaves;
 * ArrowRight moves keyboard focus into the card.
 */
export function NavPeekTrigger({
  onClick,
  onPointerDown,
  onPointerLeave,
  onKeyDown,
  onBlur,
  ...props
}: React.ComponentProps<typeof HoverCardTrigger>) {
  const { dismiss, setDismissed, setFocus, triggerRef, inputRef, rootRef } =
    useNavPeek();
  return (
    <HoverCardTrigger
      ref={(el) => {
        triggerRef.current = el;
      }}
      data-slot="nav-peek-trigger"
      asChild
      aria-haspopup="listbox"
      // on press: the press focuses the link, and Radix opens on focus
      onPointerDown={(e) => {
        dismiss();
        onPointerDown?.(e);
      }}
      onClick={(e) => {
        // a keyboard click (detail 0) gets no pointerleave to undo the dismissal
        if (e.detail > 0) dismiss();
        onClick?.(e);
      }}
      // not on enter: the browser re-fires enter on a still cursor when the
      // page changes under it, which reopened the card mid-navigation
      onPointerLeave={(e) => {
        setDismissed(false);
        onPointerLeave?.(e);
      }}
      onBlur={(e) => {
        setDismissed(false);
        onBlur?.(e);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") {
          e.preventDefault();
          setDismissed(false);
          setFocus(true);
          // the content mounts on open; focus once it is there
          requestAnimationFrame(() =>
            (inputRef.current ?? rootRef.current)?.focus(),
          );
        }
        onKeyDown?.(e);
      }}
      {...props}
    />
  );
}

export function NavPeekContent({
  className,
  children,
  label,
  onFocusCapture,
  onBlurCapture,
  onKeyDown,
  ...props
}: React.ComponentProps<typeof HoverCardContent> & {
  /** accessible name of the combobox, e.g. "Monitors" */
  label: string;
}) {
  const { setFocus, dismiss, triggerRef, rootRef } = useNavPeek();
  const { isMobile } = useSidebar();
  // mobile: the sidebar is a modal sheet, and a card portaled outside it sits
  // behind the focus trap; render it inside the sheet instead
  const [container, setContainer] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setContainer(
      isMobile
        ? (triggerRef.current?.closest<HTMLElement>("[data-mobile=true]") ??
            null)
        : null,
    );
  }, [isMobile, triggerRef]);
  return (
    <HoverCardContent
      data-slot="nav-peek-content"
      container={container ?? undefined}
      side={isMobile ? "bottom" : "right"}
      align="start"
      // py-1.5 + 1px border: the search lands on the trigger's row
      alignOffset={isMobile ? 0 : -7}
      sideOffset={isMobile ? 4 : 8}
      // px-1 + the rows' px-2 puts text 12px in, like the sidebar;
      // 514px is the search plus 13 rows, then the list scrolls
      className={cn(
        "group/peek flex max-h-[min(var(--radix-hover-card-content-available-height),514px)] w-72 flex-col px-1 py-1.5 data-[side=bottom]:w-(--radix-hover-card-trigger-width)",
        className,
      )}
      onFocusCapture={(e) => {
        setFocus(true);
        onFocusCapture?.(e);
      }}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocus(false);
        onBlurCapture?.(e);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          // dismissed first, or focusing the trigger reopens the card
          dismiss();
          triggerRef.current?.focus();
        }
        onKeyDown?.(e);
      }}
      {...props}
    >
      <CommandPrimitive
        ref={rootRef}
        label={label}
        filter={filter}
        loop
        className="flex min-h-0 flex-1 flex-col gap-1"
      >
        {children}
      </CommandPrimitive>
    </HoverCardContent>
  );
}

export function NavPeekSearch({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Input>) {
  const { inputRef } = useNavPeek();
  return (
    <CommandPrimitive.Input
      ref={inputRef}
      data-slot="nav-peek-search"
      className={cn(
        "bg-muted/50 placeholder:text-muted-foreground focus-visible:bg-muted font-commit-mono h-8 shrink-0 rounded-md px-2 text-sm tracking-tight outline-none",
        className,
      )}
      {...props}
    />
  );
}

/** Rows keep the sidebar's 36px pitch (h-8 + gap-1); `NavGroup` keeps groups on the same grid. */
export function NavPeekList({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      data-slot="nav-peek-list"
      className={cn(
        "min-h-0 overflow-y-auto [&_[cmdk-list-sizer]]:flex [&_[cmdk-list-sizer]]:flex-col [&_[cmdk-list-sizer]]:gap-1",
        className,
      )}
      {...props}
    />
  );
}

/** An option that opens `href` on click or enter. */
export function NavPeekItem({
  href,
  variant,
  className,
  children,
  onSelect,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Item> & {
  href: string;
  variant: StatusVariant;
}) {
  const { close } = useNavPeek();
  const { setOpenMobile } = useSidebar();
  const router = useRouter();
  return (
    <CommandPrimitive.Item
      data-slot="nav-peek-item"
      onSelect={(value) => {
        close();
        setOpenMobile(false);
        router.push(href);
        onSelect?.(value);
      }}
      className={cn(
        // the keyboard highlight only shows while focus is in the card
        "hover:bg-muted group-focus-within/peek:data-[selected=true]:bg-muted font-commit-mono flex h-8 shrink-0 cursor-pointer items-center gap-2 rounded-md px-2 text-sm tracking-tight outline-none",
        className,
      )}
      {...props}
    >
      <StatusDot variant={variant} />
      {children}
    </CommandPrimitive.Item>
  );
}

/**
 * Pinned last row of `NavPeekList`, e.g. "Create monitor"; stays through any search.
 * With `onPaywall` set (plan limit reached) it opens the paywall instead of `href`.
 */
export function NavPeekCreate({
  href,
  onPaywall,
  className,
  children,
  onSelect,
  ...props
}: Omit<React.ComponentProps<typeof CommandPrimitive.Item>, "value"> & {
  href: string;
  onPaywall?: () => void;
}) {
  const { close } = useNavPeek();
  const { setOpenMobile } = useSidebar();
  const router = useRouter();
  return (
    <CommandPrimitive.Item
      data-slot="nav-peek-create"
      value={CREATE_VALUE}
      forceMount
      onSelect={(value) => {
        close();
        if (onPaywall) {
          // the sidebar sheet stays open on mobile: the dialog renders inside it
          onPaywall();
        } else {
          setOpenMobile(false);
          router.push(href);
        }
        onSelect?.(value);
      }}
      className={cn(
        // sticky over the scrolling rows; the shadow fills the gap-1 above it
        "bg-popover hover:bg-muted hover:text-foreground group-focus-within/peek:data-[selected=true]:bg-muted group-focus-within/peek:data-[selected=true]:text-foreground text-muted-foreground font-commit-mono sticky bottom-0 flex h-8 shrink-0 cursor-pointer items-center gap-2 rounded-md px-2 text-sm tracking-tight shadow-[0_-4px_0_var(--color-popover)] outline-none",
        className,
      )}
      {...(onPaywall
        ? { "data-track": "paywall_viewed", "data-limited": true }
        : {})}
      {...props}
    >
      {/* a dot-wide slot: the label lines up with the item titles above */}
      <span className="flex size-2 shrink-0 items-center justify-center">
        <Add className="size-3.5 shrink-0" />
      </span>
      {children}
    </CommandPrimitive.Item>
  );
}

export function NavPeekItemTitle({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="nav-peek-item-title"
      className={cn("min-w-0 flex-1 truncate", className)}
      {...props}
    />
  );
}

const navPeekItemMetaVariants = cva("shrink-0 text-xs", {
  variants: {
    variant: {
      default: "text-muted-foreground",
      success: "text-success",
      warning: "text-warning",
      destructive: "text-destructive",
      info: "text-info",
    } satisfies Record<StatusVariant, string>,
  },
  defaultVariants: { variant: "default" },
});

/** Right-aligned reason, e.g. "down 12m" or "until 13:50". */
export function NavPeekItemMeta({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof navPeekItemMetaVariants>) {
  return (
    <span
      data-slot="nav-peek-item-meta"
      className={cn(navPeekItemMetaVariants({ variant }), className)}
      {...props}
    />
  );
}

export function NavPeekEmpty({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty
      data-slot="nav-peek-empty"
      className={cn(
        "text-muted-foreground flex h-8 items-center px-2 text-sm",
        className,
      )}
      {...props}
    />
  );
}
