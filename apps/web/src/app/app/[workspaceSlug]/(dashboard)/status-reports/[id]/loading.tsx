import { Separator, Skeleton } from "@openstatus/ui";

import { Header } from "@/components/dashboard/header";

export default function Loading() {
  return (
    <div className="grid gap-6 md:grid-cols-1 md:gap-8">
      <div className="col-span-full flex w-full justify-between">
        <Header.Skeleton withDescription={false}>
          <Skeleton className="h-9 w-20" />
        </Header.Skeleton>
      </div>
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
    </div>
  );
}
