import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
} from "@openstatus/ui";

import { cn } from "@/lib/utils";

interface CardProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title: React.ReactNode;
  description?: string;
  actions?: React.ReactNode | React.ReactNode[];
}

function Container({
  title,
  description,
  actions,
  className,
  children,
}: CardProps) {
  return (
    <Card
      className={cn("relative w-full border-border/50 shadow-none", className)}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="font-medium text-lg tracking-normal">
            {title}
          </CardTitle>
          {description ? (
            <CardDescription>{description}</CardDescription>
          ) : null}
        </div>
        {actions ? (
          <div className="flex items-center gap-2">{actions}</div>
        ) : null}
      </CardHeader>
      {/* potentially `asChild` */}
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function ContainerSkeleton() {
  return <Skeleton className="h-24 w-full" />;
}

Container.Skeleton = ContainerSkeleton;

export { Container };
