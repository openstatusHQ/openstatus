import {
  CardContent,
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function ActionCard({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <Card
      className={cn("group/action-card shadow-none py-4 gap-4", className)}
      {...props}
    >
      {children}
    </Card>
  );
}

export function ActionCardHeader({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <CardHeader className={cn("px-4 [.border-b]:pb-4", className)} {...props}>
      {children}
    </CardHeader>
  );
}

export function ActionCardGroup({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("grid gap-4", className)} {...props}>
      {children}
    </div>
  );
}

export function ActionCardTitle({
  children,
  ...props
}: React.ComponentProps<"div">) {
  return <CardTitle {...props}>{children}</CardTitle>;
}

export function ActionCardDescription({
  children,
  ...props
}: React.ComponentProps<"div">) {
  return <CardDescription {...props}>{children}</CardDescription>;
}

export function ActionCardContent({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <CardContent className={cn("px-4", className)} {...props}>
      {children}
    </CardContent>
  );
}

export function ActionCardFooter({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <CardFooter className={cn("px-4 [.border-t]:pt-4", className)} {...props}>
      {children}
    </CardFooter>
  );
}
