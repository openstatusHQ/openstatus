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
      className={cn("text-foreground font-medium", className)}
      {...props}
    >
      {children}
    </NextLink>
  );
}
