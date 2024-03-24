import Link from "next/link";
import * as React from "react";

// Hottake: you don't need a features page if you have a changelog page
// Except for SEO

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@openstatus/ui";

export function BrandName() {
  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <Link
          href="/"
          className="font-cal text-muted-foreground hover:text-foreground text-lg"
        >
          OpenStatus
        </Link>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem asChild>
          <a href="/assets/logos/OpenStatus.svg" download="openstatus.svg">
            Download SVG
          </a>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
