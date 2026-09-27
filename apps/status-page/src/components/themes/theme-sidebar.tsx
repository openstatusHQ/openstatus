"use client";

import {
  ChevronDown,
  Copy,
  Sidebar as SidebarIcon,
  Reset,
} from "@openstatus/icons";
import {
  type Theme,
  type ThemeExportFormat,
  type ThemeVarName,
  serializeTheme,
} from "@openstatus/theme-store";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  ButtonGroup,
  ButtonGroupText,
} from "@openstatus/ui/components/ui/button-group";
import { Checkbox } from "@openstatus/ui/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@openstatus/ui/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@openstatus/ui/components/ui/dropdown-menu";
import {
  InputGroup,
  InputGroupInput,
} from "@openstatus/ui/components/ui/input-group";
import { Kbd, KbdGroup } from "@openstatus/ui/components/ui/kbd";
import { Label } from "@openstatus/ui/components/ui/label";
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
} from "@openstatus/ui/components/ui/sidebar";
import { Skeleton } from "@openstatus/ui/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@openstatus/ui/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@openstatus/ui/components/ui/tooltip";
import { useCopyToClipboard } from "@openstatus/ui/hooks/use-copy-to-clipboard";
import { useDebounce } from "@openstatus/ui/hooks/use-debounce";
import { useDebounceCallback } from "@openstatus/ui/hooks/use-debounce-callback";
import { cn } from "@openstatus/ui/lib/utils";
import { useTheme } from "next-themes";
import { useQueryStates } from "nuqs";
import { useEffect, useState } from "react";

import { searchParamsParsers } from "../../app/(public)/search-params";
import { recomputeStyles } from "../status-page/floating-button";
import {
  ThemePromptButton,
  ThemeSkillInstallCommand,
} from "./theme-agent-actions";
import { useThemeBuilder } from "./theme-builder-provider";
import { ThemePasteDialog } from "./theme-paste-dialog";

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

type ThemeInfoField = "id" | "name" | "author.name" | "author.url";

const THEME_BUILDER_INFO: { id: ThemeInfoField; label: string }[] = [
  { id: "id", label: "ID" },
  { id: "name", label: "Name" },
  { id: "author.name", label: "Author" },
  { id: "author.url", label: "Link" },
];

const THEME_EXPORT_FORMATS: { id: ThemeExportFormat; label: string }[] = [
  { id: "ts", label: "TypeScript file" },
  { id: "json", label: "JSON" },
  { id: "css", label: "CSS variables" },
];

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

function getInfo(theme: Theme, field: ThemeInfoField) {
  switch (field) {
    case "id":
      return theme.id;
    case "name":
      return theme.name;
    case "author.name":
      return theme.author.name;
    case "author.url":
      return theme.author.url;
  }
}

function setInfo(theme: Theme, field: ThemeInfoField, value: string): Theme {
  switch (field) {
    case "id":
      return { ...theme, id: value };
    case "name":
      return { ...theme, name: value };
    case "author.name":
      return { ...theme, author: { ...theme.author, name: value } };
    case "author.url":
      return { ...theme, author: { ...theme.author, url: value } };
  }
}

export function ThemeSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const [{ b }, setSearchParams] = useQueryStates(searchParamsParsers);
  const { theme: newTheme, setTheme: setNewTheme, reset } = useThemeBuilder();
  const { resolvedTheme, setTheme } = useTheme();
  const { copy } = useCopyToClipboard();
  const [isMounted, setIsMounted] = useState(false);
  const debouncedNewTheme = useDebounce(newTheme, 100);
  const { setOpen } = useSidebar();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (b) {
      setOpen(true);
      setSearchParams({ b: null });
    }
  }, [b, setOpen, setSearchParams]);

  useEffect(() => {
    if (!resolvedTheme || !isMounted) return;
    recomputeStyles(debouncedNewTheme.id, { ...debouncedNewTheme });
  }, [resolvedTheme, isMounted, debouncedNewTheme]);

  function copyTheme(format: ThemeExportFormat) {
    const label = THEME_EXPORT_FORMATS.find((f) => f.id === format)?.label;
    copy(serializeTheme(newTheme, format), { withToast: `Copied ${label}` });
  }

  return (
    <Sidebar side="right" {...props}>
      <SidebarHeader className="border-border border-b px-3 font-medium">
        <div className="flex items-center justify-between gap-2">
          <div>Theme Builder</div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={reset}
              >
                <span className="sr-only">Reset</span>
                <Reset />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>Reset theme</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <Collapsible key="info" defaultOpen className="group/collapsible">
          <SidebarGroup className="pt-2 pb-0">
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger>
                Information
                <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {THEME_BUILDER_INFO.map((config) => (
                    <SidebarMenuItem key={config.id}>
                      <SidebarMenuButton asChild>
                        <div>
                          <ButtonGroup className="w-full">
                            <ButtonGroupText className="w-24">
                              <Label htmlFor={config.id}>{config.label}</Label>
                            </ButtonGroupText>
                            <InputGroup className="h-7">
                              <InputGroupInput
                                id={config.id}
                                value={getInfo(newTheme, config.id)}
                                onChange={(e) =>
                                  setNewTheme((prev) =>
                                    setInfo(prev, config.id, e.target.value),
                                  )
                                }
                              />
                            </InputGroup>
                          </ButtonGroup>
                        </div>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>
        <SidebarGroup className="py-0">
          <SidebarGroupLabel>Theme Mode</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <div>
                    {!isMounted ? (
                      <Skeleton className="h-8 w-full" />
                    ) : (
                      <Tabs
                        value={resolvedTheme}
                        onValueChange={(value) =>
                          setTheme(value as "light" | "dark")
                        }
                        className="w-full"
                      >
                        <TabsList className="h-8 w-full">
                          <TabsTrigger value="light">Light</TabsTrigger>
                          <TabsTrigger value="dark">Dark</TabsTrigger>
                        </TabsList>
                      </Tabs>
                    )}
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {Object.entries(THEME_STYLE_BUILDER).map(([key, config]) => (
          <Collapsible key={key} defaultOpen className="group/collapsible">
            <SidebarGroup className="py-0">
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
                          <SidebarMenuButton asChild>
                            <div>
                              <span className="truncate">{value.label}</span>
                              <ThemeValueSelector
                                config={config}
                                id={value.id}
                                theme={newTheme}
                                setTheme={setNewTheme}
                                isMounted={isMounted}
                              />
                            </div>
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
        <Collapsible key="agent" defaultOpen className="group/collapsible">
          <SidebarGroup className="pt-0">
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger>
                Agent
                <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent className="space-y-2 px-2">
                <p className="text-muted-foreground text-xs">
                  Let your agent design the theme. The prompt carries the
                  current configuration and the output format you can paste back
                  here.
                </p>
                <ThemePromptButton size="sm" className="w-full" />
                <ThemeSkillInstallCommand />
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>
      </SidebarContent>
      <SidebarFooter className="border-border border-t">
        <div className="grid grid-cols-2 gap-2">
          <ThemePasteDialog variant="outline" size="sm" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm">
                <Copy className="size-4" />
                Copy
                <ChevronDown className="size-3.5 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {THEME_EXPORT_FORMATS.map((format) => (
                <DropdownMenuItem
                  key={format.id}
                  onSelect={() => copyTheme(format.id)}
                >
                  {format.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

function ThemeValueSelector(props: {
  config: ThemeBuilderColor | ThemeBuilderCheckbox;
  id: ThemeVarName;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isMounted: boolean;
}) {
  const { resolvedTheme } = useTheme();

  const handleChange = useDebounceCallback((value: string) => {
    const mode = resolvedTheme as "light" | "dark";
    props.setTheme({
      ...props.theme,
      [mode]: {
        ...props.theme[mode],
        [props.id]: value,
      },
    });
  }, 100);

  if (!props.isMounted || !resolvedTheme)
    return <Skeleton className="border-foreground/70 ml-auto size-4 border" />;

  const value = props.theme[resolvedTheme as "light" | "dark"][props.id];

  if (props.config.type === "color") {
    return (
      <label
        className="border-foreground/70 ml-auto size-4 rounded-full border"
        style={{ backgroundColor: value }}
        htmlFor={props.id}
      >
        <input
          type="color"
          id={props.id}
          name={props.id}
          value={value}
          className="sr-only"
          onChange={(e) => handleChange(e.target.value)}
        />
      </label>
    );
  }

  if (props.config.type === "checkbox") {
    const { options } = props.config;
    const checked =
      options.find((option) => option.value === value)?.label ?? false;
    return (
      <label htmlFor={props.id} className="ml-auto flex items-center gap-2">
        <span className="text-muted-foreground font-mono text-xs">
          {value ??
            options.find((option) => option.label === false)?.value ??
            ""}
        </span>
        <Checkbox
          id={props.id}
          name={props.id}
          checked={checked}
          className="bg-background size-4"
          onCheckedChange={(checked) =>
            props.setTheme({
              ...props.theme,
              [resolvedTheme as "light" | "dark"]: {
                ...props.theme[resolvedTheme as "light" | "dark"],
                [props.id]: checked
                  ? (options.find((option) => option.label === true)?.value ??
                    "")
                  : (options.find((option) => option.label === false)?.value ??
                    ""),
              },
            })
          }
        />
      </label>
    );
  }

  return (
    <span className="text-muted-foreground ml-auto font-mono text-xs">
      {value}
    </span>
  );
}

export function SidebarTrigger({
  className,
  onClick,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { toggleSidebar } = useSidebar();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
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
      </TooltipTrigger>
      <TooltipContent side="left" className="flex items-center gap-2">
        Toggle Sidebar
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>B</Kbd>
        </KbdGroup>
      </TooltipContent>
    </Tooltip>
  );
}
