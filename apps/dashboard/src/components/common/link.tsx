import NextLink from "next/link";

import { cn } from "@/lib/utils";

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
      className={cn("text-foreground font-medium", className)}
      {...externalProps}
      {...props}
    >
      {children}
    </NextLink>
  );
}
