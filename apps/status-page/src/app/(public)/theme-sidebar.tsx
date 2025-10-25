"use client";

import { recomputeStyles } from "@/components/status-page/floating-button";
import { Button } from "@/components/ui/button";
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  THEMES,
  type ThemeKey,
  type ThemeVarName,
} from "@openstatus/theme-store";
import { ChevronDown, PanelRightIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useQueryStates } from "nuqs";
import { useEffect, useState } from "react";
import { searchParamsParsers } from "./search-params";

type ThemeBuilderColor = {
  label: string;
  type: "color";
  values: { id: ThemeVarName; label: string }[];
};

type ThemeBuilderCheckbox = {
  label: string;
  type: "checkbox";
  values: { id: ThemeVarName; label: string }[];
  options: { value: string; label: boolean }[];
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
    type: "checkbox",
    values: [{ id: "--radius", label: "Border Radius" }],
    options: [
      { value: "0rem", label: false },
      { value: "0.625rem", label: true },
    ],
  },
} satisfies Record<string, ThemeBuilderColor | ThemeBuilderCheckbox>;

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
  const { resolvedTheme } = useTheme();
  const theme = t ? THEMES[t as keyof typeof THEMES] : undefined;

  return (
    <Sidebar side="right" {...props}>
      <SidebarHeader className="border-b border-border px-3 font-medium">
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
                          <SidebarMenuButton key={t}>
                            <span className="truncate">{value.label}</span>
                            <ThemeValueSelector
                              config={config}
                              id={value.id}
                              theme={t}
                            />
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
        <Button size="sm">Copy Configuration</Button>
      </SidebarFooter>
    </Sidebar>
  );
}

function ThemeValueSelector(props: {
  config: ThemeBuilderColor | ThemeBuilderCheckbox;
  id: ThemeVarName;
  theme: ThemeKey;
}) {
  const [value, setValue] = useState(getComputedValue(props.id));

  useEffect(() => {
    recomputeStyles(props.theme, {
      light: {
        [props.id]: value,
      },
      dark: {
        [props.id]: value,
      },
    });
  }, [props.id, value]);

  if (!value) return null;

  if (props.config.type === "color") {
    return (
      <label
        className="ml-auto size-4 border border-foreground/70 rounded-full"
        style={{ backgroundColor: value }}
        htmlFor={props.id}
      >
        <input
          type="color"
          id={props.id}
          name={props.id}
          value={value}
          className="sr-only"
          onChange={(e) => setValue(e.target.value)}
        />
      </label>
    );
  }

  if (props.config.type === "checkbox") {
    const { options } = props.config;
    const checked = options.find((option) => option.value === value)?.label;
    return (
      <label htmlFor={props.id} className="ml-auto flex items-center gap-2">
        <span className="text-xs text-muted-foreground font-mono">{value}</span>
        <Checkbox
          id={props.id}
          name={props.id}
          checked={checked}
          className="size-4 bg-background"
          onCheckedChange={(checked) =>
            setValue(
              checked
                ? options.find((option) => option.label === true)?.value ?? ""
                : options.find((option) => option.label === false)?.value ?? "",
            )
          }
        />
      </label>
    );
  }

  return (
    <span className="ml-auto text-muted-foreground font-mono text-xs">
      {value}
    </span>
  );
}

function getComputedValue(value: string) {
  if (typeof window === "undefined") return null;
  return getComputedStyle(document.documentElement).getPropertyValue(value);
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
