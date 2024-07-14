import { Separator, Skeleton } from "@openstatus/ui";

export default function Loading() {
  return (
    <div className="col-span-full flex flex-col gap-6">
      <div className="space-y-3">
        <div className="flex items-end justify-between">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-7 w-full max-w-[200px]" />
            <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-sm">
              <Skeleton className="h-5 w-full max-w-[100px]" />
              <span className="text-muted-foreground/50 text-xs">•</span>
              <Skeleton className="h-[22px] w-24 rounded-full" />
              <span className="text-muted-foreground/50 text-xs">•</span>
              <Skeleton className="h-[22px] w-16 rounded-full" />
            </div>
          </div>
          <Skeleton className="h-8 w-48" />
        </div>
        <Separator />
      </div>
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}
