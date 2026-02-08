import { Skeleton } from "@openstatus/ui/components/ui/skeleton";
import { cn } from "@openstatus/ui/lib/utils";

export function TableCellSkeleton({
  className,
  ...props
}: React.ComponentProps<typeof Skeleton>) {
  return <Skeleton className={cn("h-5 w-12", className)} {...props} />;
}
