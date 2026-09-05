"use client";

import { useControls } from "@openstatus/ui/components/data-table-filters/controls";
import { cn } from "@openstatus/ui/lib/utils";

/**
 * The hit area on the filter sidebar's border, mirroring the app sidebar's
 * rail. Absolutely positioned so it costs no layout width; the accessible
 * control is the toolbar's Hide/Show Controls button.
 */
export function DataTableFilterRail({
  className,
  ...props
}: React.ComponentProps<"button">) {
  const { open, setOpen } = useControls();

  return (
    <button
      type="button"
      data-slot="data-table-filter-rail"
      aria-label="Toggle Filters"
      aria-expanded={open}
      title="Toggle Filters"
      tabIndex={-1}
      onClick={() => setOpen((prev) => !prev)}
      className={cn(
        // z-30: above the table's own sticky header, which is z-20
        "absolute inset-y-0 left-0 z-30 hidden w-4 -translate-x-1/2 sm:block",
        "after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] after:transition-colors",
        "hover:after:bg-border",
        open ? "cursor-w-resize" : "cursor-e-resize",
        className,
      )}
      {...props}
    />
  );
}
