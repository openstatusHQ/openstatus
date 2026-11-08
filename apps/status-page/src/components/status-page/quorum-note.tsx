import { cn } from "@openstatus/ui/lib/utils";
import { useExtracted } from "next-intl";

export function QuorumNote({ className, ...props }: React.ComponentProps<"p">) {
  const t = useExtracted();
  return (
    <p
      data-slot="quorum-note"
      className={cn("text-muted-foreground text-xs", className)}
      {...props}
    >
      {t(
        "Since November 2026, a check covers all of a monitor's regions and counts as down when at least half of them fail.",
      )}
    </p>
  );
}
