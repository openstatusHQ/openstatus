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
      <ContextMenuTrigger asChild>
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/assets/landing/openstatus-logo.svg"
            alt="openstatus logo"
            width={20}
            height={20}
            className="border-border dark:border-foreground rounded-[50%] border"
          />
          <span className="hidden sm:block">openstatus</span>
        </Link>
      </ContextMenuTrigger>
      <ContextMenuContent className="min-w-[var(--radix-dropdown-menu-trigger-width)] rounded-none">
        <ContextMenuItem className="rounded-none px-3 py-2 font-mono" asChild>
          <a href="/assets/logos/OpenStatus.svg" download="openstatus.svg">
            Download Name SVG
          </a>
        </ContextMenuItem>
        <ContextMenuItem className="rounded-none px-3 py-2 font-mono" asChild>
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
