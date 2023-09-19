import * as React from "react";
import Link from "next/link";

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
          className="font-cal text-muted-foreground hover:text-foreground"
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
