import { Container } from "@/components/dashboard/container";
import { Header } from "@/components/dashboard/header";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="grid gap-6 md:gap-8">
      <Header.Skeleton />
      <div className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-8 w-64" />
        </div>
        <Container.Skeleton />
      </div>
    </div>
  );
}
