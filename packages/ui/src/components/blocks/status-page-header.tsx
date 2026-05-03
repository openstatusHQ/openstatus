"use client";

import { Button } from "@openstatus/ui/components/ui/button";
import { cn } from "@openstatus/ui/lib/utils";

/**
 * StatusPageHeader — presentation-only header chrome.
 *
 * Compose with `StatusPageHeaderContent`, `StatusPageHeaderBrand`,
 * `StatusPageHeaderNav` (+ `Item`), and `StatusPageHeaderActions`. Embed
 * gating, route-aware active state, mobile menu shell, brand link target,
 * and tRPC fetch all stay in the wrapping app.
 */
export function StatusPageHeader({
  className,
  ...props
}: React.ComponentProps<"header">) {
  return (
    <header
      data-slot="status-page-header"
      className={cn(className)}
      {...props}
    />
  );
}

export function StatusPageHeaderContent({
  className,
  ...props
}: React.ComponentProps<"nav">) {
  return (
    <nav
      data-slot="status-page-header-content"
      className={cn(
        "mx-auto flex max-w-2xl items-center justify-between gap-3 px-3 py-2",
        className,
      )}
      {...props}
    />
  );
}

/**
 * StatusPageHeaderBrand — left-side fixed-width slot. Pass the brand button
 * (with link target) as children.
 */
export function StatusPageHeaderBrand({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="status-page-header-brand"
      className={cn("flex w-[150px] shrink-0", className)}
      {...props}
    />
  );
}

/**
 * StatusPageHeaderBrandButton — outlined size-8 icon button that hosts the
 * brand link. Pass the actual link element as children via `asChild`.
 */
export function StatusPageHeaderBrandButton({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      data-slot="status-page-header-brand-button"
      variant="outline"
      size="icon"
      className={cn("size-8 overflow-hidden", className)}
      asChild
      {...props}
    />
  );
}

/**
 * StatusPageHeaderBrandFallback — letter-from-title typography used when no
 * page icon is present. Renders the first character of up to two words,
 * uppercased.
 */
export function StatusPageHeaderBrandFallback({
  title,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & { title?: string }) {
  const initials =
    (title ?? "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word.charAt(0))
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";
  return (
    <div
      data-slot="status-page-header-brand-fallback"
      className={cn(
        "flex size-8 items-center justify-center font-mono",
        className,
      )}
      {...props}
    >
      {initials}
    </div>
  );
}

/**
 * StatusPageHeaderNav — desktop nav list. Compose with
 * `StatusPageHeaderNavItem` children.
 */
export function StatusPageHeaderNav({
  className,
  ...props
}: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="status-page-header-nav"
      className={cn("flex flex-row gap-0.5", className)}
      {...props}
    />
  );
}

/**
 * StatusPageHeaderNavItem — single nav entry. Pass the link element via
 * `asChild`; the block renders the Button chrome and active styling.
 */
export function StatusPageHeaderNavItem({
  isActive,
  className,
  ...props
}: React.ComponentProps<typeof Button> & { isActive?: boolean }) {
  return (
    <li data-slot="status-page-header-nav-item">
      <Button
        data-slot="status-page-header-nav-item-button"
        data-active={isActive ? "true" : undefined}
        variant={isActive ? "secondary" : "ghost"}
        size="sm"
        asChild
        className={cn(
          "border",
          isActive ? "border-input" : "border-transparent",
          className,
        )}
        {...props}
      />
    </li>
  );
}

/**
 * StatusPageHeaderActions — right-side fixed-width cluster (subscribe,
 * contact, mobile-menu trigger). Pass actions as children; the block is
 * layout-only.
 */
export function StatusPageHeaderActions({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="status-page-header-actions"
      className={cn(
        "flex min-w-[150px] items-center justify-end gap-2",
        className,
      )}
      {...props}
    />
  );
}
