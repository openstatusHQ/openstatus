"use client";

import * as Portal from "@radix-ui/react-portal";

/**
 * Visually marks the whole app as being under construction.
 *
 *  – A red (destructive) border wraps the entire viewport.
 *  – A small badge in the top-right corner reads "In Development".
 *
 * It renders through a Radix UI Portal so it stays above any layout elements
 * like sidebars.
 */
export function DevelopmentIndicator() {
  if (process.env.NODE_ENV !== "production") return null;

  return (
    <Portal.Root>
      {/* border */}
      <div className="pointer-events-none fixed inset-0 z-[9999] border-2 border-destructive" />

      {/* label */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[9999] select-none">
        <div className="flex items-center justify-center">
          <div className="bg-destructive text-background w-fit font-mono text-xs rounded-b px-2 py-1">
            In Development
          </div>
        </div>
      </div>
    </Portal.Root>
  );
}
