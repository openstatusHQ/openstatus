import { Skeleton } from "@openstatus/ui/src/components/skeleton";

import { Container } from "@/components/dashboard/container";
import { Header } from "@/components/dashboard/header";

export default function Loading() {
  return (
    <div className="grid gap-6">
      <Header.Skeleton />
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-3">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
        <Skeleton className="h-4 w-28" />
      </div>
      <div className="grid gap-4">
        <Container.Skeleton />
        <Container.Skeleton />
      </div>
      <div className="grid gap-4">
        <Container.Skeleton />
      </div>
    </div>
  );
}
