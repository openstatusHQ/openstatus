import { Skeleton } from "@openstatus/ui";

import { Header } from "@/components/dashboard/header";

export default function Loading() {
  return (
    <div className="grid gap-6 md:grid-cols-1 md:gap-8">
      <div className="col-span-full flex w-full justify-between">
        <Header.Skeleton />
      </div>
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-72 w-full" />
    </div>
  );
}
