import { cn } from "@/lib/utils";
import NextLink from "next/link";

// TODO: we could add cva variants for the link

export function Link({
  children,
  className,
  ...props
}: React.ComponentProps<typeof NextLink>) {
  return (
    <NextLink
      className={cn("font-medium text-foreground", className)}
      {...props}
    >
      {children}
    </NextLink>
  );
}
