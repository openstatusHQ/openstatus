import { Skeleton } from "@openstatus/ui";

import { Header } from "@/components/dashboard/header";
import { SkeletonForm } from "@/components/forms/skeleton-form";

export default function Loading() {
  return (
    <div className="grid gap-6 md:grid-cols-2 md:gap-8">
      <div className="col-span-full flex w-full justify-between">
        <Header.Skeleton>
          <Skeleton className="h-9 w-20" />
        </Header.Skeleton>
      </div>
      <div className="col-span-full">
        <SkeletonForm />
      </div>
    </div>
  );
}
