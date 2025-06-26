import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export function TableCellSkeleton({
  className,
  ...props
}: React.ComponentProps<typeof Skeleton>) {
  return <Skeleton className={cn("h-5 w-12", className)} {...props} />;
}
