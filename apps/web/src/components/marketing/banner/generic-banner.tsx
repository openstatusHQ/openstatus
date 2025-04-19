import { Shell } from "@/components/dashboard/shell";
import { cn } from "@/lib/utils";

interface GenericBannerProps {
  title: string;
  description: string;
  className?: string;
  actions: React.ReactNode;
}

export function GenericBanner({
  title,
  description,
  className,
  actions,
}: GenericBannerProps) {
  return (
    <Shell
      className={cn(
        "flex flex-col gap-3 bg-accent/50 md:flex-row md:items-center md:justify-between",
        className,
      )}
    >
      <div>
        <p className="font-semibold text-2xl">{title}</p>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      {actions}
    </Shell>
  );
}
