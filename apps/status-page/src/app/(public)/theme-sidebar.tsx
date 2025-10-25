"use client";

import { Button } from "@/components/ui/button";
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { InputGroup, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { THEMES, type ThemeVarName } from "@openstatus/theme-store";
import { ChevronDown, PanelRightIcon } from "lucide-react";
import { useQueryStates } from "nuqs";
import { searchParamsParsers } from "./search-params";

type ThemeBuilderColor = {
  label: string;
  type: "color";
  values: { id: ThemeVarName; label: string }[];
};

type ThemeBuilderSlider = {
  label: string;
  type: "slider";
  values: { id: ThemeVarName; label: string }[];
  steps: number[];
};

const THEME_BUILDER_INFO = {
  id: {
    label: "ID",
    id: "id",
    type: "text",
  },
  name: {
    label: "Name",
    id: "name",
    type: "text",
  },
  author: {
    label: "Author",
    id: "author.name",
    type: "text",
  },
  authorUrl: {
    label: "Link",
    id: "author.url",
    type: "text",
  },
} as const;

const THEME_STYLE_BUILDER = {
  base: {
    label: "Base Colors",
    type: "color",
    values: [
      { id: "--foreground", label: "Foreground" },
      { id: "--background", label: "Background" },
      // consider linking both border and input to the same color
      { id: "--border", label: "Border" },
      { id: "--input", label: "Input" },
    ],
  },
  brand: {
    label: "Brand Colors",
    type: "color",
    values: [
      { id: "--primary", label: "Primary" },
      { id: "--primary-foreground", label: "Primary Foreground" },
      // consider linking both secondary, muted, accent to the same color
      { id: "--secondary", label: "Secondary" },
      { id: "--muted", label: "Muted" },
      { id: "--muted-foreground", label: "Muted Foreground" },
      { id: "--accent", label: "Accent" },
      { id: "--accent-foreground", label: "Accent Foreground" },
    ],
  },
  status: {
    label: "Status Colors",
    type: "color",
    values: [
      { id: "--success", label: "Operational" },
      { id: "--destructive", label: "Error" },
      { id: "--warning", label: "Degraded" },
      { id: "--info", label: "Maintenance" },
    ],
  },
  "border-radius": {
    label: "Border Radius",
    type: "slider",
    values: [{ id: "--radius", label: "Border Radius" }],
    steps: [0, 0.625], // 0.625 is default shadcn/ui value
  },
} satisfies Record<string, ThemeBuilderColor | ThemeBuilderSlider>;

// Helper function to get nested property value from an object
function getNestedValue(obj: any, path: string): string | undefined {
  const keys = path.split(".");
  let value = obj;
  for (const key of keys) {
    if (value === undefined || value === null) return undefined;
    value = value[key];
  }
  return value;
}

export function ThemeSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const [{ t }] = useQueryStates(searchParamsParsers);
  const theme = t ? THEMES[t as keyof typeof THEMES] : undefined;
  return (
    <Sidebar side="right" {...props}>
      <SidebarHeader className="border-b border-border">
        Theme Builder
      </SidebarHeader>
      <SidebarContent>
        <Collapsible key="info" defaultOpen className="group/collapsible">
          <SidebarGroup className="pt-2">
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger>
                Information
                <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {Object.entries(THEME_BUILDER_INFO).map(([key, config]) => (
                    <SidebarMenuItem key={key}>
                      {/* NOTE: use key to force re-render when theme changes */}
                      <SidebarMenuButton key={t}>
                        <ButtonGroup className="w-full">
                          <ButtonGroupText>
                            <Label htmlFor={config.id}>{config.label}</Label>
                          </ButtonGroupText>
                          <InputGroup className="h-7">
                            <InputGroupInput
                              id={config.id}
                              defaultValue={
                                theme ? getNestedValue(theme, config.id) : ""
                              }
                            />
                          </InputGroup>
                        </ButtonGroup>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>
        {Object.entries(THEME_STYLE_BUILDER).map(([key, config], index) => (
          <Collapsible key={key} defaultOpen className="group/collapsible">
            <SidebarGroup
              className={cn(
                index !== Object.entries(THEME_STYLE_BUILDER).length - 1
                  ? "py-0"
                  : "pt-0",
              )}
            >
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger>
                  {config.label}
                  <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {config.values.map((value) => {
                      return (
                        <SidebarMenuItem key={value.id}>
                          <SidebarMenuButton>
                            <span className="truncate">{value.label}</span>
                            <ThemeValueSelector config={config} id={value.id} />
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        ))}
      </SidebarContent>
      <SidebarFooter className="border-t border-border">
        <Button variant="outline" size="sm">
          Copy Configuration
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}

function ThemeValueSelector(props: {
  config: ThemeBuilderColor | ThemeBuilderSlider;
  id: ThemeVarName;
}) {
  const value = getComputedValue(props.id);
  if (!value) return null;

  if (props.config.type === "color") {
    return (
      <div
        className="ml-auto size-3 border border-foreground/70 rounded-full"
        style={{ backgroundColor: value }}
      />
    );
  }
  return (
    <span className="ml-auto text-muted-foreground font-mono text-xs">
      {value}
    </span>
  );
}

function getComputedValue(value: string | { key: string; label: string }) {
  if (typeof window === "undefined") return null;
  const element = document.getElementById("theme-styles");
  if (!element) return null;
  return getComputedStyle(element).getPropertyValue(
    typeof value === "string" ? value : value.key,
  );
}

export function SidebarTrigger({
  className,
  onClick,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { toggleSidebar } = useSidebar();

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
      <PanelRightIcon />
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  );
}
