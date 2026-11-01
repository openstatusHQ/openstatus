import NextLink from "next/link";

import { cn } from "@/lib/utils";

/**
 * Dashed underline, muted while a `group/row` is hovered and dark on the link
 * itself; `http` hrefs open in a new tab.
 */
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
      className={cn(
        "text-foreground decoration-muted-foreground/50 hover:decoration-foreground font-medium decoration-dashed underline-offset-2 transition-[text-decoration-color] duration-150 ease-[ease] group-hover/row:underline hover:underline",
        className,
      )}
      {...externalProps}
      {...props}
    >
      {children}
    </NextLink>
  );
}
