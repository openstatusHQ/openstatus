import { cn } from "@openstatus/ui/lib/utils";
import { StatusIcon as UnifiedStatusIcon } from "@openstatus/ui/components/blocks/status-icon";

export function Status({
  children,
  className,
  variant = "success",
  ...props
}: React.ComponentProps<"div"> & {
  variant?: "success" | "degraded" | "error" | "info";
}) {
  return (
    <div
      data-variant={variant}
      data-slot="status"
      className={cn("group peer flex flex-col gap-8", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function StatusBrand({
  src,
  alt,
  className,
  ...props
}: React.ComponentProps<"img">) {
  return (
    // biome-ignore lint/a11y/useAltText: <explanation>
    <img src={src} alt={alt} className={cn("size-8", className)} {...props} />
  );
}

export function StatusHeader({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="status-header"
      className={cn("@container/status-header", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function StatusTitle({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "font-semibold text-foreground text-lg leading-none",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function StatusDescription({
  children,
  className,
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("text-muted-foreground", className)}>{children}</div>
  );
}

export function StatusContent({
  children,
  className,
}: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-3", className)}>{children}</div>;
}

export function StatusIcon({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <UnifiedStatusIcon variant="default" className={className} {...props} />
  );
}
