import { Badge } from "@openstatus/ui/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@openstatus/ui/components/ui/card";
import { cn } from "@openstatus/ui/lib/utils";

export function ActionCard({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <Card
      className={cn("group/action-card gap-4 py-4 shadow-none", className)}
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
    <CardHeader
      className={cn(
        "px-4 *:data-[slot=card-description]:col-span-full [.border-b]:pb-4",
        className,
      )}
      {...props}
    >
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

/** Sits top-right of an `ActionCardHeader`. */
export function ActionCardBadge({
  className,
  variant = "outline",
  ...props
}: React.ComponentProps<typeof Badge>) {
  return (
    <Badge
      data-slot="card-action"
      variant={variant}
      className={cn(
        "text-muted-foreground col-start-2 row-start-1 self-center justify-self-end font-mono font-normal",
        className,
      )}
      {...props}
    />
  );
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
