import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type VariantProps, cva } from "class-variance-authority";

const noteVariants = cva(
  "flex items-center gap-3 rounded-md border px-3 py-2 [&>svg]:size-4 [&>svg]:text-current [&>svg]:shrink-0",
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
    },
    defaultVariants: {
      variant: "default",
      color: "default",
    },
  },
);

export function Note({
  children,
  className,
  variant = "default",
  color = "default",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof noteVariants>) {
  return (
    <div
      data-variant={variant}
      className={cn(noteVariants({ variant, color, className }))}
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
