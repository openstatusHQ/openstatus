import { cn } from "@/lib/utils";
import { Skeleton } from "../ui/skeleton";

interface HeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string | null;
}

/**
 * use `children` to include a Button e.g.
 */
function Header({ title, description, className, children }: HeaderProps) {
  return (
    <div
      className={cn(
        "col-span-full mr-12 flex justify-between md:mr-0",
        className,
      )}
    >
      <div className="grid w-full gap-1">
        <h1 className="font-cal text-3xl">{title}</h1>
        {description ? (
          <p className="text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function HeaderSkeleton({ children }: { children?: React.ReactNode }) {
  return (
    <div className="col-span-full mr-12 flex w-full justify-between md:mr-0">
      <div className="grid w-full gap-3">
        <Skeleton className="h-8 w-full max-w-[200px]" />
        <Skeleton className="h-4 w-full max-w-[300px]" />
      </div>
      {children}
    </div>
  );
}

Header.Skeleton = HeaderSkeleton;

export { Header };
