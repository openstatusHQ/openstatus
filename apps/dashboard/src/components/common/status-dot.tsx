import { cn } from "@openstatus/ui/lib/utils";
import { type VariantProps, cva } from "class-variance-authority";

const statusDotVariants = cva("inline-block size-2 shrink-0 rounded-full", {
  variants: {
    variant: {
      default: "bg-muted-foreground",
      success: "bg-success",
      warning: "bg-warning",
      destructive: "bg-destructive",
      info: "bg-info",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export type StatusVariant = NonNullable<
  VariantProps<typeof statusDotVariants>["variant"]
>;

export function StatusDot({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof statusDotVariants>) {
  return (
    <span
      data-slot="status-dot"
      aria-hidden="true"
      className={cn(statusDotVariants({ variant }), className)}
      {...props}
    />
  );
}
