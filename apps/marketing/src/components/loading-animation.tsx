import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const loadingVariants = cva(
  "animate-pulse rounded-full direction-alternate duration-700",
  {
    variants: {
      variant: {
        // we might want to inverse both styles
        default: "bg-primary-foreground",
        inverse: "bg-primary",
      },
      size: {
        default: "h-1 w-1",
        lg: "h-1.5 w-1.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

interface Props
  extends React.ComponentProps<"div">,
    VariantProps<typeof loadingVariants> {}

export function LoadingAnimation({
  className,
  variant,
  size,
  ...props
}: Props) {
  return (
    <div
      className={cn("flex items-center justify-center gap-1", className)}
      {...props}
    >
      <div className={cn(loadingVariants({ variant, size }))} />
      <div className={cn(loadingVariants({ variant, size }), "delay-150")} />
      <div className={cn(loadingVariants({ variant, size }), "delay-300")} />
    </div>
  );
}
