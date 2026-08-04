import { Skeleton } from "@openstatus/ui/components/ui/skeleton";

/**
 * Fallback for segment transitions. The shell (sidebar, header) is rendered by
 * the surrounding layout and stays put — only the main area swaps.
 */
export default function Loading() {
  return (
    <div className="flex w-full flex-1 flex-col gap-4 p-4">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-4 w-72" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
