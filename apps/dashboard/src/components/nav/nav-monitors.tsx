"use client";

import React, { useState } from "react";

import {
  Code,
  Eye,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Search,
  Send,
  Tag,
  XIcon,
} from "lucide-react";

import { ExportCodeDialog } from "@/components/dialogs/export-code";
import { QuickActions } from "@/components/dropdowns/quick-actions";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Monitor } from "@/data/monitors";
import { getActions } from "@/data/monitors.client";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

const STATUS: Record<Monitor["status"], string> = {
  Degraded: "bg-warning border border-warning",
  Failing: "bg-destructive border border-destructive",
  Inactive: "bg-muted-foreground border border-muted-foreground",
  Normal: "bg-success border border-success",
};

interface Filter {
  keywords: string | undefined;
  tags: string[] | undefined;
  active: boolean[] | undefined;
  type: ("HTTP" | "TCP")[] | undefined;
  visibility: boolean[] | undefined;
}

export function NavMonitors({ monitors }: { monitors: Monitor[] }) {
  const [openDialog, setOpenDialog] = useState(false);
  const { isMobile, setOpenMobile } = useSidebar();
  const [filter, setFilter] = React.useState<Filter>({
    keywords: undefined,
    tags: [],
    active: [],
    type: [],
    visibility: [],
  });
  const router = useRouter();
  const pathname = usePathname();
  const actions = getActions({
    edit: () => router.push("/dashboard/monitors/edit"),
    "copy-id": () => {
      navigator.clipboard.writeText("ID");
      toast.success("Monitor ID copied to clipboard");
    },
    export: () => setOpenDialog(true),
  });

  function handleFilterChange<T extends keyof Filter>(
    key: T,
    value: NonNullable<Filter[T]> extends (infer U)[] ? U : Filter[T],
  ) {
    setFilter((prev) => {
      if (key === "keywords") {
        return {
          ...prev,
          [key]: value as string,
        };
      }

      const prevArray = prev[key] as unknown[];
      return {
        ...prev,
        [key]: prevArray?.includes(value)
          ? prevArray.filter((v) => v !== value)
          : [...(prevArray || []), value],
      };
    });
  }

  const filteredMonitors = monitors.filter((item) =>
    filter.tags?.length
      ? item.tags.some((tag) => filter.tags?.includes(tag))
      : true,
  );

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel
        className="flex items-center justify-between pr-1"
        style={{ paddingRight: 4 }}
      >
        <span>
          Monitors{" "}
          <code className="text-muted-foreground">
            ({filteredMonitors.length}
            {filteredMonitors.length !== monitors.length
              ? `/${monitors.length}`
              : ""}
            )
          </code>
        </span>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuAction className="relative top-0 right-0">
                      <Search className="text-muted-foreground" />
                      <span className="sr-only">Filter</span>
                    </SidebarMenuAction>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="left" align="center">
                  Filter Monitors
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <DropdownMenuContent
              className="w-56"
              side={isMobile ? "bottom" : "right"}
              align={isMobile ? "end" : "start"}
            >
              <DropdownMenuLabel>Filter options</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem asChild>
                  <Input
                    type="text"
                    tabIndex={0}
                    className="h-8"
                    onKeyDown={(e) => {
                      e.stopPropagation();
                    }}
                    placeholder="Keywords"
                    onChange={(e) => {
                      console.log("input change with e:", e);
                      handleFilterChange("keywords", e.target.value);
                    }}
                    onClick={(e) => e.preventDefault()}
                    onSelect={(e) => e.preventDefault()}
                  />
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="flex items-center gap-2 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0">
                    <Tag className="text-muted-foreground" />
                    Tags
                  </DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent>
                      <DropdownMenuCheckboxItem
                        checked={filter.tags?.includes("Production")}
                        onSelect={(e) => {
                          e.preventDefault();
                          handleFilterChange("tags", "Production");
                        }}
                      >
                        Production
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={filter.tags?.includes("Development")}
                        onSelect={(e) => {
                          e.preventDefault();
                          handleFilterChange("tags", "Development");
                        }}
                      >
                        Development
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={filter.tags?.includes("Staging")}
                        onSelect={(e) => {
                          e.preventDefault();
                          handleFilterChange("tags", "Staging");
                        }}
                      >
                        Staging
                      </DropdownMenuCheckboxItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="flex items-center gap-2 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0">
                    <Send className="text-muted-foreground" />
                    Active
                  </DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent>
                      <DropdownMenuCheckboxItem
                        checked={filter.active?.includes(true)}
                        onSelect={(e) => {
                          e.preventDefault();
                          handleFilterChange("active", true);
                        }}
                      >
                        Yes
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={filter.active?.includes(false)}
                        onSelect={(e) => {
                          e.preventDefault();
                          handleFilterChange("active", false);
                        }}
                      >
                        No
                      </DropdownMenuCheckboxItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="flex items-center gap-2 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0">
                    <Code className="text-muted-foreground" />
                    Type
                  </DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent>
                      <DropdownMenuCheckboxItem
                        checked={filter.type?.includes("HTTP")}
                        onSelect={(e) => {
                          e.preventDefault();
                          handleFilterChange("type", "HTTP");
                        }}
                      >
                        HTTP
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={filter.type?.includes("TCP")}
                        onSelect={(e) => {
                          e.preventDefault();
                          handleFilterChange("type", "TCP");
                        }}
                      >
                        TCP
                      </DropdownMenuCheckboxItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="flex items-center gap-2 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0">
                    <Eye className="text-muted-foreground" />
                    Visibility
                  </DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent>
                      <DropdownMenuCheckboxItem
                        checked={filter.visibility?.includes(true)}
                        onSelect={(e) => {
                          e.preventDefault();
                          handleFilterChange("visibility", true);
                        }}
                      >
                        Public
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={filter.visibility?.includes(false)}
                        onSelect={(e) => {
                          e.preventDefault();
                          handleFilterChange("visibility", false);
                        }}
                      >
                        Private
                      </DropdownMenuCheckboxItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setFilter({
                    keywords: undefined,
                    tags: undefined,
                    active: undefined,
                    type: undefined,
                    visibility: undefined,
                  });
                }}
              >
                <RotateCcw /> Clear filters
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <SidebarMenuAction
                  className="relative top-0 right-0 border"
                  onClick={() => {
                    router.push("/dashboard/monitors/create");
                    setOpenMobile(false);
                  }}
                >
                  <Plus className="text-muted-foreground" />
                  <span className="sr-only">Create Monitor</span>
                </SidebarMenuAction>
              </TooltipTrigger>
              <TooltipContent side="right" align="center">
                Create Monitor
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </SidebarGroupLabel>
      <SidebarMenu>
        <SidebarMenuItem className="mx-2 flex flex-wrap gap-0.5">
          {Object.keys(filter).map((key) => {
            const filterValue = filter[key as keyof Filter];
            if (typeof filterValue === "string") {
              return (
                <Badge
                  key={`${key}-${filterValue}`}
                  variant="outline"
                  className="overflow-visible"
                >
                  {filterValue}
                  <button
                    type="button"
                    className="-my-[5px] -ms-0.5 -me-2 inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-[inherit] p-0 text-foreground/60 outline-none transition-[color,box-shadow] hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    onClick={() => {
                      handleFilterChange(key as keyof Filter, filterValue);
                    }}
                    aria-label="Delete"
                  >
                    <XIcon className="size-3" aria-hidden="true" />
                  </button>
                </Badge>
              );
            }
            if (Array.isArray(filterValue)) {
              return filterValue.map((item) => {
                return (
                  <Badge
                    key={`${key}-${item}`}
                    variant="outline"
                    className="overflow-visible"
                  >
                    {item.toString()}
                    <button
                      type="button"
                      className="-my-[5px] -ms-0.5 -me-2 inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-[inherit] p-0 text-foreground/60 outline-none transition-[color,box-shadow] hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                      onClick={() => {
                        // @ts-expect-error we know that the item is a string
                        handleFilterChange(key as keyof Filter, item);
                      }}
                      aria-label="Delete"
                    >
                      <XIcon className="size-3" aria-hidden="true" />
                    </button>
                  </Badge>
                );
              });
            }
            return null;
          })}
        </SidebarMenuItem>
        {filteredMonitors.map((item) => {
          // NOTE: once you have a router, you can use it to check if the item is active
          const isActive = item.url.startsWith(pathname);
          console.log({ isActive });
          return (
            <SidebarMenuItem key={item.name}>
              <SidebarMenuButton
                className="group-has-data-[sidebar=menu-dot]/menu-item:pr-11"
                asChild
              >
                <Link
                  href="/dashboard/monitors/overview"
                  onClick={() => setOpenMobile(false)}
                >
                  <span>{item.name}</span>
                </Link>
              </SidebarMenuButton>
              <div
                data-sidebar="menu-dot"
                className={cn(
                  "absolute top-1.5 right-1 flex h-2.5 items-center justify-center p-2.5 transition-all duration-200 group-focus-within/menu-item:right-6 group-hover/menu-action:right-6 group-hover/menu-item:right-6 group-data-[state=open]/menu-action:right-6 [&:has(+[data-sidebar=menu-action][data-state=open])]:right-6",
                  isMobile && "right-6",
                )}
              >
                <div className="relative flex items-center justify-center">
                  <div
                    className={cn(
                      "-translate-x-1/2 -translate-y-1/2 absolute top-1/2 left-1/2 h-2 w-2 rounded-full",
                      STATUS[item.status],
                    )}
                  >
                    <span className="sr-only">{item.status}</span>
                  </div>
                </div>
              </div>
              <QuickActions
                actions={actions}
                deleteAction={{
                  title: "Monitor",
                  confirmationValue: "delete monitor",
                }}
                side={isMobile ? "bottom" : "right"}
                align={isMobile ? "end" : "start"}
              >
                <SidebarMenuAction showOnHover>
                  <MoreHorizontal />
                  <span className="sr-only">More</span>
                </SidebarMenuAction>
              </QuickActions>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
      <ExportCodeDialog open={openDialog} onOpenChange={setOpenDialog} />
    </SidebarGroup>
  );
}
