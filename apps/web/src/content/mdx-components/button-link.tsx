import { GitHubIcon } from "@openstatus/icons/brand";
import { Button } from "@openstatus/ui/components/ui/button";
import type React from "react";

import { cn } from "@/lib/utils";

import { CustomLink } from "./custom-link";

const icons = { github: GitHubIcon };

/** `icon` renders before the children; the icon's own title names it. */
export function ButtonLink({
  icon,
  children,
  ...props
}: React.ComponentProps<typeof Button> & {
  href: string;
  icon?: keyof typeof icons;
}) {
  const Icon = icon ? icons[icon] : null;
  return (
    <Button
      variant="outline"
      size="lg"
      className={cn(
        "data-[variant=default]:text-background! h-auto rounded-none px-3 py-2 text-base no-underline!",
        Icon && "text-muted-foreground hover:text-foreground",
      )}
      asChild
      {...props}
    >
      <CustomLink href={props.href}>
        {Icon ? (
          <>
            <Icon className="size-5" />
            {children}
          </>
        ) : (
          children
        )}
      </CustomLink>
    </Button>
  );
}
