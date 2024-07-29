import { Skeleton } from "@openstatus/ui/src/components/skeleton";

interface SkeletonTabsProps {
  children?: React.ReactNode;
}

export function SkeletonTabs({ children }: SkeletonTabsProps) {
  return (
    <div className="w-full">
      <div className="flex items-center border-b">
        <Skeleton className="h-9 w-16 px-3 py-1.5" />
        <Skeleton className="h-9 w-16 px-3 py-1.5" />
      </div>
      {/* tbd: if children is empty, we could render a skeleton container */}
      <div className="mt-3">{children}</div>
    </div>
  );
}
