import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function TableCellSkeleton({
  className,
  ...props
}: React.ComponentProps<typeof Skeleton>) {
  return <Skeleton className={cn("h-5 w-12", className)} {...props} />;
}
