import { Skeleton } from "@openstatus/ui";

// TODO: can be improved...

export default function Loading() {
  return (
    <div className="grid gap-6 md:grid-cols-1 md:gap-8">
      <Skeleton className="h-72 w-full" />
    </div>
  );
}
