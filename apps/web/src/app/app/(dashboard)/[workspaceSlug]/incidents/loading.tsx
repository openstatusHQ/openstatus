import { Header } from "@/components/dashboard/header";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="grid gap-6 md:grid-cols-1 md:gap-8">
      <div className="col-span-full flex w-full justify-between">
        <Header.Skeleton>
          <Skeleton className="h-9 w-20" />
        </Header.Skeleton>
      </div>
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}
