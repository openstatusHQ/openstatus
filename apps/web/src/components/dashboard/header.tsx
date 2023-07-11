import { cn } from "@/lib/utils";
import { Skeleton } from "../ui/skeleton";

interface HeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string | null;
}

function Header({ title, description, className }: HeaderProps) {
  return (
    <div className={cn("col-span-full grid gap-1", className)}>
      <h1 className="font-cal text-3xl">{title}</h1>
      {description ? (
        <p className="text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}

function HeaderSkeleton() {
  return (
    <div className="col-span-full grid gap-3">
      <Skeleton className="h-8 w-[200px]" />
      <Skeleton className="h-4 w-[300px]" />
    </div>
  );
}

Header.Skeleton = HeaderSkeleton;

export { Header };
