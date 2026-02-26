import { Button } from "@openstatus/ui/components/ui/button";
import { cn } from "@openstatus/ui/lib/utils";

export function BillingOverlayContainer({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("relative", className)} {...props}>
      {children}
    </div>
  );
}

export function BillingOverlay({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "to-background absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-b from-transparent to-50% p-2",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function BillingOverlayButton({
  children,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button size="sm" {...props}>
      {children}
    </Button>
  );
}

export function BillingOverlayDescription({
  children,
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "text-muted-foreground max-w-xs text-center text-sm",
        className,
      )}
      {...props}
    >
      {children}
    </p>
  );
}
