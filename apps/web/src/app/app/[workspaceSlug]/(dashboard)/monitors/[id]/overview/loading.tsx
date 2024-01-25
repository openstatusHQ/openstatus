import { Skeleton } from "@openstatus/ui";

export default function Loading() {
  return (
    <div className="grid gap-4">
      <Skeleton className="h-5 w-40" />
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <div className="grid gap-1">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-10 w-[150px]" />
        </div>
        <div className="grid gap-1">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-10 w-[150px]" />
        </div>
        <div className="grid gap-1">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-10 w-[150px]" />
        </div>
      </div>
      <Skeleton className="h-[396px] w-full" />
    </div>
  );
}
