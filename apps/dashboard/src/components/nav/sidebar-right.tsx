"use client";

import { Sidebar as SidebarIcon } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@openstatus/ui/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@openstatus/ui/components/ui/tooltip";
import { cn } from "@openstatus/ui/lib/utils";
import * as React from "react";

import { Kbd } from "../common/kbd";
import { SidebarMetadata, type SidebarMetadataProps } from "./sidebar-metadata";

const SIDEBAR_KEYBOARD_SHORTCUT = "]";

type SidebarRightProps = React.ComponentProps<typeof Sidebar> & {
  header: string;
  metadata: SidebarMetadataProps[];
  footerButton?: React.ComponentProps<typeof SidebarMenuButton>;
};

export function SidebarRight({
  header,
  metadata,
  footerButton,
  ...props
}: SidebarRightProps) {
  return (
    <Sidebar
      collapsible="offcanvas"
      side="right"
      className="top-14 flex h-[calc(100svh_-_56px)]"
      {...props}
    >
      <SidebarHeader className="border-sidebar-border relative border-b">
        {header}
        <div className="absolute inset-y-0 -left-9 z-10 flex items-center justify-center">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <SidebarTrigger />
              </TooltipTrigger>
              <TooltipContent side="left">
                <p className="mr-px inline-flex items-center">
                  Toggle Sidebar{" "}
                  <Kbd className="border-muted-foreground bg-primary text-background font-mono">
                    ⌘
                  </Kbd>
                  <Kbd className="border-muted-foreground bg-primary text-background font-mono">
                    {SIDEBAR_KEYBOARD_SHORTCUT}
                  </Kbd>
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </SidebarHeader>
      <SidebarContent className="flex flex-col gap-0">
        {metadata.map((item) => (
          <SidebarMetadata key={item.label} {...item} />
        ))}
      </SidebarContent>
      <SidebarSeparator className="mx-0" />
      {footerButton ? (
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton {...footerButton} />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      ) : null}
    </Sidebar>
  );
}

export function SidebarTrigger({
  className,
  onClick,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { toggleSidebar } = useSidebar();

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === SIDEBAR_KEYBOARD_SHORTCUT &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault();
        toggleSidebar();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar]);

  return (
    <Button
      data-sidebar="trigger"
      data-slot="sidebar-trigger"
      variant="ghost"
      size="icon"
      className={cn("size-7", className)}
      onClick={(event) => {
        onClick?.(event);
        toggleSidebar();
      }}
      {...props}
    >
      <SidebarIcon />
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  );
}
