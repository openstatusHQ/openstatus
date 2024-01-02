import { Skeleton } from "@openstatus/ui";

export default function Loading() {
  return (
    <div className="grid gap-4">
      <Skeleton className="h-5 w-40" />
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-24" />
      </div>
      <Skeleton className="h-[396px] w-full" />
    </div>
  );
}
