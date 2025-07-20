"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { PanelRight } from "lucide-react";
import { Kbd } from "../common/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { SidebarMetadata, type SidebarMetadataProps } from "./sidebar-metadata";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useIsMobile } from "@/hooks/use-mobile";

const SIDEBAR_KEYBOARD_SHORTCUT = "]";
const SIDEBAR_WIDTH = "18rem";
const SIDEBAR_WIDTH_2XL = "24rem";
const SIDEBAR_WIDTH_MOBILE = "18rem";

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
  const isMobile = useIsMobile();
  const is2XL = useMediaQuery("(min-width: 1536px)");
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": isMobile
            ? SIDEBAR_WIDTH_MOBILE
            : is2XL
              ? SIDEBAR_WIDTH_2XL
              : SIDEBAR_WIDTH,
        } as React.CSSProperties
      }
      defaultOpen={false}
      cookieName="sidebar_state_right"
    >
      <Sidebar
        collapsible="offcanvas"
        side="right"
        className="top-14 flex h-[calc(100svh_-_56px)]"
        {...props}
      >
        <SidebarHeader className="relative border-sidebar-border border-b">
          {header}
          <div className="-left-9 absolute inset-y-0 z-10 flex items-center justify-center">
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
    </SidebarProvider>
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
