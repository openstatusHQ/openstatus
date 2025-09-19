import { cn } from "@/lib/utils";
import { type VariantProps, cva } from "class-variance-authority";
import NextLink from "next/link";

export const linkVariants = cva(
  // NOTE: use same ring styles as the button
  "outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px] rounded-sm",
  {
    variants: {
      variant: {
        default: "text-foreground font-medium",
        container: "focus-visible:border-ring",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export function Link({
  children,
  className,
  variant,
  ...props
}: React.ComponentProps<typeof NextLink> & VariantProps<typeof linkVariants>) {
  return (
    <NextLink className={cn(linkVariants({ variant, className }))} {...props}>
      {children}
    </NextLink>
  );
}
