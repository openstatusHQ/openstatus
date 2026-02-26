import { cn } from "@/lib/utils";
import type React from "react";

export function Grid({
  cols = 2,
  children,
  className,
}: {
  cols?: 1 | 2 | 3 | 4 | 5;
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

  // Remove left border from all except first column (only on md+ screens)
  const leftBorderClass = {
    1: "",
    2: "md:[&>*]:border-l-0 md:[&>*:nth-child(2n+1)]:border-l",
    3: "md:[&>*]:border-l-0 md:[&>*:nth-child(3n+1)]:border-l",
    4: "md:[&>*]:border-l-0 md:[&>*:nth-child(4n+1)]:border-l",
    5: "md:[&>*]:border-l-0 md:[&>*:nth-child(5n+1)]:border-l",
  };

  return (
    <div
      className={cn(
        "my-4 grid grid-cols-1",
        "[&>*]:border [&>*]:border-border [&>*]:p-4",
        // NOTE: remove extra margin from prose grid cells of first and last element
        "[&>*>*:first-child]:!mt-0 [&>*>*:last-child]:!mb-0",
        colsClass[cols],
        topBorderClass[cols],
        leftBorderClass[cols],
        className,
      )}
    >
      {children}
    </div>
  );
}
