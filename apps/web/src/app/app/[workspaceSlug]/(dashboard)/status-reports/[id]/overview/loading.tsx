import { Separator, Skeleton } from "@openstatus/ui";

export default function Loading() {
  return (
    <div className="col-span-full flex flex-col gap-6">
      <div className="grid grid-cols-5 gap-3 text-sm">
        <Skeleton className="col-start-1 h-5 max-w-[100px]" />
        <Skeleton className="col-span-4 h-5 w-full max-w-[200px]" />
        <Skeleton className="col-start-1 h-5 max-w-[100px]" />
        <Skeleton className="col-span-4 h-5 w-full max-w-[100px]" />
        <Skeleton className="col-start-1 h-5 max-w-[100px]" />
        <div className="col-span-4 flex gap-2">
          <Skeleton className="h-5 w-full max-w-[60px]" />
          <Skeleton className="h-5 w-full max-w-[60px]" />
        </div>
      </div>
      <Separator />
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}
