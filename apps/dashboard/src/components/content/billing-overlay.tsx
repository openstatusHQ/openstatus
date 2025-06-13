import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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
        "absolute inset-0 bg-gradient-to-b from-transparent to-50% to-background items-center justify-center flex flex-col gap-2",
        className
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
        "text-sm text-muted-foreground max-w-xs text-center",
        className
      )}
      {...props}
    >
      {children}
    </p>
  );
}
