import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Skeleton } from "../ui/skeleton";

interface CardProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title: React.ReactNode;
  description?: string;
  actions: React.ReactNode | React.ReactNode[];
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
      className={cn("border-border/50 relative w-full shadow-none", className)}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="text-lg font-medium tracking-normal">
            {title}
          </CardTitle>
          {description ? (
            <CardDescription>{description}</CardDescription>
          ) : null}
        </div>
        <div className="flex gap-2">{actions}</div>
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
