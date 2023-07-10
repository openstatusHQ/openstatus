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

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
}

function Container({ title, description, className, children }: CardProps) {
  return (
    <Card className={cn("border-border/50 w-full", className)}>
      <CardHeader>
        <CardTitle className="font-medium shadow-none">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function ContainerSkeleton() {
  return <Skeleton className="h-24 w-full" />;
}

Container.Skeleton = ContainerSkeleton;

export { Container };
