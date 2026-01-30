import { cn } from "@/lib/utils";
import NextLink from "next/link";

// TODO: we could add cva variants for the link

export function Link({
  children,
  className,
  ...props
}: React.ComponentProps<typeof NextLink>) {
  const isExternal = props.href?.toString().startsWith("http");
  const externalProps = isExternal
    ? { target: "_blank", rel: "noopener noreferrer" }
    : {};

  return (
    <NextLink
      className={cn("font-medium text-foreground", className)}
      {...externalProps}
      {...props}
    >
      {children}
    </NextLink>
  );
}
