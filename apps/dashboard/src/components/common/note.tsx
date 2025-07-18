import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { cva, VariantProps } from "class-variance-authority";

const noteVariants = cva(
  "flex items-center gap-3 rounded-md border px-3 py-2",
  {
    variants: {
      variant: {
        default: "border-border bg-sidebar",
        ghost: "border-none bg-transparent",
      },
      color: {
        default: "text-foreground",
        warning: "text-warning",
        error: "text-destructive",
        success: "text-success",
      },
    },
    defaultVariants: {
      variant: "default",
      color: "default",
    },
  }
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

export function NoteIcon({
  children,
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "flex h-5 w-5 shrink-0 items-center justify-center",
        className
      )}
      {...props}
    >
      {children}
    </span>
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
      className={cn("ml-auto -mr-1 shrink-0", className)}
      {...props}
    >
      {children}
    </Button>
  );
}
