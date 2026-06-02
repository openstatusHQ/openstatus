import { cn } from "@/lib/utils";
import type React from "react";

type AsideType = "note" | "tip" | "caution" | "danger";

const ASIDE_META: Record<
  AsideType,
  { label: string; rule: string; text: string }
> = {
  note: { label: "Note", rule: "border-l-foreground", text: "text-foreground" },
  tip: { label: "Tip", rule: "border-l-info", text: "text-info" },
  caution: { label: "Caution", rule: "border-l-warning", text: "text-warning" },
  danger: {
    label: "Danger",
    rule: "border-l-destructive",
    text: "text-destructive",
  },
};

export function Aside({
  type = "note",
  title,
  children,
}: {
  type?: AsideType;
  title?: string;
  children: React.ReactNode;
}) {
  const meta = ASIDE_META[type];
  return (
    <div
      className={cn(
        "my-4 border border-border border-l-2 p-4",
        meta.rule,
        "[&>*:last-child]:!mb-0",
      )}
    >
      <p className={cn("!mt-0 mb-2 font-medium text-sm", meta.text)}>
        {title ?? meta.label}
      </p>
      {children}
    </div>
  );
}
