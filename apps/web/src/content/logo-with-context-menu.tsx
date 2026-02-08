"use client";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@openstatus/ui/components/ui/context-menu";
import Image from "next/image";
import Link from "next/link";

export function LogoWithContextMenu() {
  return (
    <ContextMenu>
      <ContextMenuTrigger className="group" asChild>
        <Link href="/" className="relative flex items-center gap-2">
          <Image
            src="/assets/landing/openstatus-logo.svg"
            alt="openstatus logo"
            width={20}
            height={20}
            className="rounded-full border border-border dark:border-foreground"
          />
          <span className="hidden sm:block">openstatus</span>
          <div className="absolute right-0.5 bottom-0 hidden group-hover:block">
            <span className="text-[10px] text-muted-foreground/50">
              [right click]
            </span>
          </div>
        </Link>
      </ContextMenuTrigger>
      <ContextMenuContent className="min-w-[var(--radix-dropdown-menu-trigger-width)] rounded-none">
        <ContextMenuItem className="rounded-none px-2 py-3 font-mono" asChild>
          <a href="/assets/logos/OpenStatus.svg" download="openstatus.svg">
            Download Name SVG
          </a>
        </ContextMenuItem>
        <ContextMenuItem className="rounded-none px-2 py-3 font-mono" asChild>
          <a
            href="/assets/logos/OpenStatus-Logo.svg"
            download="openstatus-logo.svg"
          >
            Download Logo SVG
          </a>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
