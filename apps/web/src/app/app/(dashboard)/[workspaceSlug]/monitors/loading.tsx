import { Skeleton } from "@openstatus/ui/src/components/skeleton";

import { Container } from "@/components/dashboard/container";
import { Header } from "@/components/dashboard/header";

export default function Loading() {
  return (
    <div className="grid gap-6 md:grid-cols-2 md:gap-8">
      <div className="col-span-full flex w-full justify-between">
        <Header.Skeleton>
          <Skeleton className="h-9 w-20" />
        </Header.Skeleton>
      </div>
      <Container.Skeleton />
      <Container.Skeleton />
      <Container.Skeleton />
    </div>
  );
}
