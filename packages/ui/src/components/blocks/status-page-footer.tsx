"use client";

import { useStatusBlocksLabels } from "@openstatus/ui/components/blocks/status-i18n";
import { cn } from "@openstatus/ui/lib/utils";

/**
 * StatusPageFooter — presentation-only footer chrome.
 *
 * Compose with `StatusPageFooterContent`, `StatusPagePoweredBy`, and
 * `StatusPageFooterActions`. Embed / white-label gating, locale + theme
 * switchers, and the tRPC fetch all stay in the wrapping app.
 */
export function StatusPageFooter({
  className,
  ...props
}: React.ComponentProps<"footer">) {
  return (
    <footer
      data-slot="status-page-footer"
      className={cn(className)}
      {...props}
    />
  );
}

export function StatusPageFooterContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="status-page-footer-content"
      className={cn(
        "mx-auto flex max-w-2xl items-center justify-between gap-4 px-3 py-2",
        className,
      )}
      {...props}
    />
  );
}

/**
 * StatusPagePoweredBy — "powered by …" line. The link element (with href,
 * target, utm params, app-specific Link wrapper, etc.) is supplied as
 * children so the block stays routing-agnostic.
 */
export function StatusPagePoweredBy({
  children,
  className,
  ...props
}: React.ComponentProps<"p">) {
  const labels = useStatusBlocksLabels();
  return (
    <p
      data-slot="status-page-powered-by"
      className={cn(
        "font-mono text-muted-foreground text-xs leading-none sm:text-sm",
        className,
      )}
      {...props}
    >
      {labels.poweredBy} {children}
    </p>
  );
}

/**
 * StatusPageFooterActions — right-side cluster (last-updated, locale,
 * theme). Pass actions as children; the block is layout-only.
 */
export function StatusPageFooterActions({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="status-page-footer-actions"
      className={cn("flex items-center gap-2", className)}
      {...props}
    />
  );
}
