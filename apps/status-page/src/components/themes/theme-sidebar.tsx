"use client";

import { searchParamsParsers } from "@/app/(public)/search-params";
import { recomputeStyles } from "@/components/status-page/floating-button";
import {
  THEMES,
  type Theme,
  type ThemeKey,
  type ThemeVarName,
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
import { cn } from "@openstatus/ui/lib/utils";
import {
  Check,
  ChevronDown,
  Copy,
  PanelRightIcon,
  RotateCcw,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useQueryStates } from "nuqs";
import { useEffect, useState } from "react";

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

// Helper function to get nested property value from an object
// biome-ignore lint/suspicious/noExplicitAny: <explanation>
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
  const [{ t, b }, setSearchParams] = useQueryStates(searchParamsParsers);
  const [newTheme, setNewTheme] = useState<Theme>(THEMES[t]);
  const { resolvedTheme, setTheme } = useTheme();
  const { copy, isCopied } = useCopyToClipboard();
  const [isMounted, setIsMounted] = useState(false);
  const debouncedNewTheme = useDebounce(newTheme, 100);
  const { setOpen } = useSidebar();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    setNewTheme(THEMES[t]);
  }, [t]);

  useEffect(() => {
    if (b) {
      setOpen(true);
      setSearchParams({ b: null });
    }
  }, [b, setOpen, setSearchParams]);

  useEffect(() => {
    if (!resolvedTheme || !isMounted) return;
    recomputeStyles(debouncedNewTheme.id as ThemeKey, { ...debouncedNewTheme });
  }, [resolvedTheme, isMounted, debouncedNewTheme]);

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
                onClick={() => setNewTheme(THEMES[t])}
              >
                <span className="sr-only">Reset</span>
                <RotateCcw />
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
                  {Object.entries(THEME_BUILDER_INFO).map(([key, config]) => (
                    <SidebarMenuItem key={key}>
                      <SidebarMenuButton asChild>
                        <div>
                          <ButtonGroup className="w-full">
                            <ButtonGroupText className="w-24">
                              <Label htmlFor={config.id}>{config.label}</Label>
                            </ButtonGroupText>
                            <InputGroup className="h-7">
                              <InputGroupInput
                                id={config.id}
                                defaultValue={
                                  newTheme
                                    ? getNestedValue(newTheme, config.id)
                                    : ""
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
      </SidebarContent>
      <SidebarFooter className="border-border border-t">
        <Button
          size="sm"
          onClick={() => copy(JSON.stringify(newTheme), { withToast: false })}
        >
          {isCopied ? "Configuration Copied!" : "Copy Configuration"}
          {isCopied ? (
            <Check className="size-4" />
          ) : (
            <Copy className="size-4" />
          )}
        </Button>
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

  if (!props.isMounted || !resolvedTheme)
    return <Skeleton className="ml-auto size-4 border border-foreground/70" />;

  const value = props.theme[resolvedTheme as "light" | "dark"][props.id];

  if (props.config.type === "color") {
    return (
      <label
        className="ml-auto size-4 rounded-full border border-foreground/70"
        style={{ backgroundColor: value }}
        htmlFor={props.id}
      >
        <input
          type="color"
          id={props.id}
          name={props.id}
          value={value}
          className="sr-only"
          onChange={(e) =>
            props.setTheme({
              ...props.theme,
              [resolvedTheme as "light" | "dark"]: {
                ...props.theme[resolvedTheme as "light" | "dark"],
                [props.id]: e.target.value,
              },
            })
          }
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
        <span className="font-mono text-muted-foreground text-xs">
          {value ??
            options.find((option) => option.label === false)?.value ??
            ""}
        </span>
        <Checkbox
          id={props.id}
          name={props.id}
          checked={checked}
          className="size-4 bg-background"
          onCheckedChange={(checked) =>
            props.setTheme({
              ...props.theme,
              [resolvedTheme as "light" | "dark"]: {
                ...props.theme[resolvedTheme as "light" | "dark"],
                [props.id]: checked
                  ? options.find((option) => option.label === true)?.value ?? ""
                  : options.find((option) => option.label === false)?.value ??
                    "",
              },
            })
          }
        />
      </label>
    );
  }

  return (
    <span className="ml-auto font-mono text-muted-foreground text-xs">
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
          <PanelRightIcon />
          <span className="sr-only">Toggle Sidebar</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left" className="flex items-center gap-2">
        Toggle Sidebar{" "}
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <span>+</span>
          <Kbd>B</Kbd>
        </KbdGroup>
      </TooltipContent>
    </Tooltip>
  );
}
