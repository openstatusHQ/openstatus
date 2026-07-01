import { cva } from "class-variance-authority";
import type React from "react";

import { cn } from "../../lib/utils";

type AsideType = "note" | "tip" | "caution" | "danger";

const ASIDE_LABEL: Record<AsideType, string> = {
  note: "Note",
  tip: "Tip",
  caution: "Caution",
  danger: "Danger",
};

const asideVariants = cva("border-border my-4 border p-4", {
  variants: {
    type: {
      note: "border-border",
      tip: "border-info",
      caution: "border-warning",
      danger: "border-destructive",
    },
  },
});

const asideTextVariants = cva("!mt-0 font-medium", {
  variants: {
    type: {
      note: "text-foreground",
      tip: "text-info",
      caution: "text-warning",
      danger: "text-destructive",
    },
  },
});

export function Aside({
  type = "note",
  title,
  children,
}: {
  type?: AsideType;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(asideVariants({ type }), "[&>*:last-child]:!mb-0")}
      role="note"
    >
      <p className={asideTextVariants({ type })}>
        {title ?? ASIDE_LABEL[type]}
      </p>
      {children}
    </div>
  );
}
