"use client";

import * as React from "react";

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
} from "@/components/ui/sidebar";
import { SidebarMetadata, SidebarMetadataProps } from "./sidebar-metadata";
import { Button } from "@/components/ui/button";
import { PanelRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { Kbd } from "../common/kbd";

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
      className="top-14 h-[calc(100svh_-_56px)] flex"
      style={
        {
          // "--sidebar-width": "300px",
        } as React.CSSProperties
      }
      {...props}
    >
      <SidebarHeader className="border-b border-sidebar-border relative">
        {header}
        <div className="absolute inset-y-0 -left-9 z-10 items-center justify-center flex">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <SidebarTrigger />
              </TooltipTrigger>
              <TooltipContent side="left">
                <p className="mr-px inline-flex items-center gap-1">
                  Toggle Sidebar{" "}
                  <Kbd className="bg-primary text-background border-muted-foreground">
                    ⌘+{SIDEBAR_KEYBOARD_SHORTCUT}
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

  // Adds a keyboard shortcut to toggle the sidebar.
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
      <PanelRight />
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  );
}
