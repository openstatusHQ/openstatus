import { Skeleton } from "@openstatus/ui";

import { cn } from "@/lib/utils";

interface HeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string | null;
  actions?: React.ReactNode | React.ReactNode[];
}

/**
 * use `children` to include a Button e.g.
 */
function Header({ title, description, className, actions }: HeaderProps) {
  return (
    <div
      className={cn(
        "col-span-full mr-12 flex items-start justify-between lg:mr-0",
        className,
      )}
    >
      <div className="flex w-full flex-col gap-1">
        <h1 className="font-cal text-3xl">{title}</h1>
        {description ? (
          <p className="text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-1 items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

function HeaderSkeleton({
  children,
  withDescription = true,
}: {
  children?: React.ReactNode;
  withDescription?: boolean;
}) {
  return (
    <div className="col-span-full mr-12 flex w-full justify-between lg:mr-0">
      <div className="grid w-full gap-3">
        <Skeleton className="h-8 w-full max-w-[200px]" />
        {withDescription && <Skeleton className="h-4 w-full max-w-[300px]" />}
      </div>
      {children}
    </div>
  );
}

Header.Skeleton = HeaderSkeleton;

export { Header };
