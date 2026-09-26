import type React from "react";

import { cn } from "@/lib/utils";

export function Grid({
  cols = 2,
  // Four columns collapse to a single column too early; step through two at `sm`.
  sm = cols === 4 ? 2 : undefined,
  variant = "bordered",
  children,
  className,
}: {
  cols?: 1 | 2 | 3 | 4 | 5;
  /** Intermediate column count between the single mobile column and `cols` at `md`. Defaults to 2 for `cols={4}`. */
  sm?: 2 | 3;
  /** `borderless` for a text + visual pair; the visual carries its own border. */
  variant?: "bordered" | "borderless";
  children: React.ReactNode;
  className?: string;
}) {
  const colsClass = {
    1: "md:grid-cols-1",
    2: "md:grid-cols-2",
    3: "md:grid-cols-3",
    4: "md:grid-cols-4",
    5: "md:grid-cols-5",
  };

  // Remove top border from all except first row
  const topBorderClass = {
    1: "[&>*]:border-t-0 [&>*:first-child]:border-t",
    2: "[&>*]:border-t-0 [&>*:first-child]:border-t md:[&>*:nth-child(-n+2)]:border-t",
    3: "[&>*]:border-t-0 [&>*:first-child]:border-t md:[&>*:nth-child(-n+3)]:border-t",
    4: "[&>*]:border-t-0 [&>*:first-child]:border-t md:[&>*:nth-child(-n+4)]:border-t",
    5: "[&>*]:border-t-0 [&>*:first-child]:border-t md:[&>*:nth-child(-n+5)]:border-t",
  };

  const smColsClass = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3" };
  // Scoped to the sm-only range so the md rules above win once `cols` applies.
  const smBorderClass = {
    2: "sm:max-md:[&>*:nth-child(-n+2)]:border-t sm:max-md:[&>*]:border-l-0 sm:max-md:[&>*:nth-child(2n+1)]:border-l",
    3: "sm:max-md:[&>*:nth-child(-n+3)]:border-t sm:max-md:[&>*]:border-l-0 sm:max-md:[&>*:nth-child(3n+1)]:border-l",
  };

  // Remove left border from all except first column (only on md+ screens)
  const leftBorderClass = {
    1: "",
    2: "md:[&>*]:border-l-0 md:[&>*:nth-child(2n+1)]:border-l",
    3: "md:[&>*]:border-l-0 md:[&>*:nth-child(3n+1)]:border-l",
    4: "md:[&>*]:border-l-0 md:[&>*:nth-child(4n+1)]:border-l",
    5: "md:[&>*]:border-l-0 md:[&>*:nth-child(5n+1)]:border-l",
  };

  if (variant === "borderless") {
    return (
      <div
        className={cn(
          "my-8 grid grid-cols-1 items-start gap-8 md:gap-12",
          // A demo with an unbreakable string must truncate, never widen the page.
          "[&>*]:min-w-0",
          "[&>*>*:first-child]:!mt-0 [&>*>*:last-child]:!mb-0",
          sm && smColsClass[sm],
          colsClass[cols],
          className,
        )}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "my-4 grid grid-cols-1",
        "[&>*]:border-border [&>*]:min-w-0 [&>*]:border [&>*]:p-4",
        // NOTE: remove extra margin from prose grid cells of first and last element
        "[&>*>*:first-child]:!mt-0 [&>*>*:last-child]:!mb-0",
        sm && smColsClass[sm],
        colsClass[cols],
        topBorderClass[cols],
        leftBorderClass[cols],
        sm && smBorderClass[sm],
        className,
      )}
    >
      {children}
    </div>
  );
}
