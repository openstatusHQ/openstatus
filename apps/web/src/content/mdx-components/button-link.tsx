import { Button } from "@openstatus/ui/components/ui/button";
import type React from "react";

import { CustomLink } from "./custom-link";

export function ButtonLink(
  props: React.ComponentProps<typeof Button> & { href: string },
) {
  return (
    <Button
      variant="outline"
      size="lg"
      className="h-auto rounded-none px-4 py-4 text-base no-underline!"
      asChild
      {...props}
    >
      <CustomLink href={props.href}>{props.children}</CustomLink>
    </Button>
  );
}
