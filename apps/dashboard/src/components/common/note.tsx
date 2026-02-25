import { Button } from "@openstatus/ui/components/ui/button";
import { cn } from "@openstatus/ui/lib/utils";
import { type VariantProps, cva } from "class-variance-authority";

const noteVariants = cva(
  "flex items-center gap-2 rounded-xl border [&>svg]:text-current [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border-border",
        ghost: "border-none bg-transparent",
      },
      color: {
        default: "text-foreground bg-sidebar",
        warning: "text-warning border-warning/50 bg-warning/5",
        error: "text-destructive border-destructive/50 bg-destructive/5",
        success: "text-success border-success/50 bg-success/5",
        info: "text-info border-info/50 bg-info/5",
      },
      size: {
        default: "px-3 py-2 text-base [&>svg]:size-4",
        sm: "px-2.5 py-1.5 text-sm [&>svg]:size-3.5",
      },
    },
    defaultVariants: {
      variant: "default",
      color: "default",
      size: "default",
    },
  },
);

export function Note({
  children,
  className,
  variant = "default",
  color = "default",
  size = "default",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof noteVariants>) {
  return (
    <div
      data-variant={variant}
      className={cn(noteVariants({ variant, color, size, className }))}
      {...props}
    >
      {children}
    </div>
  );
}

export function NoteButton({
  children,
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      size="sm"
      className={cn("-mr-1 ml-auto shrink-0", className)}
      {...props}
    >
      {children}
    </Button>
  );
}
