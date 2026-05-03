import { cn } from "@openstatus/ui/lib/utils";

/**
 * StatusPageShell — outer chrome wrapper around `<header>`, `<main>`, and
 * `<footer>`.
 *
 * Bare structural `<div>` with sensible defaults (full-height column with
 * gap). Routing-agnostic: it knows nothing about embed mode. Apps that
 * support embedding wrap this with their own provider that toggles
 * `group/embed` + `data-embed` / `data-hide-*` attributes from above.
 *
 * Override `min-h-screen` via `className` (e.g. `min-h-0`) when mounting
 * inside a constrained container like a dashboard preview card.
 */
export function StatusPageShell({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="status-page-shell"
      className={cn("flex min-h-screen flex-col gap-4", className)}
      {...props}
    />
  );
}

/**
 * StatusPageMain — inner `<main>` content column.
 *
 * Centers content at `max-w-2xl` with the canonical padding and column
 * layout. Routing- and embed-agnostic: callers that support an embed mode
 * layer their own `group-data-*` classes via `className`.
 */
export function StatusPageMain({
  className,
  ...props
}: React.ComponentProps<"main">) {
  return (
    <main
      data-slot="status-page-main"
      className={cn(
        "mx-auto flex w-full max-w-2xl flex-1 flex-col px-3 py-2",
        className,
      )}
      {...props}
    />
  );
}
