"use client";

import { ThemeSelect } from "@/components/themes/theme-select";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  THEMES,
  THEME_KEYS,
  generateThemeStyles,
} from "@openstatus/theme-store";
import { Check, ChevronsUpDown, Settings } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import type React from "react";
import { createContext, useContext, useEffect, useState } from "react";

export const IS_DEV = process.env.NODE_ENV === "development";

export const VARIANT = ["success", "degraded", "error", "info"] as const;
export type VariantType = (typeof VARIANT)[number];

export const CARD_TYPE = ["duration", "requests", "manual"] as const;
export type CardType = (typeof CARD_TYPE)[number];

export const BAR_TYPE = ["absolute", "manual"] as const;
export type BarType = (typeof BAR_TYPE)[number];

export const COMMUNITY_THEME = THEME_KEYS;
export type CommunityTheme = (typeof COMMUNITY_THEME)[number];

interface StatusPageContextType {
  cardType: CardType;
  setCardType: (cardType: CardType) => void;
  barType: BarType;
  setBarType: (barType: BarType) => void;
  showUptime: boolean;
  setShowUptime: (showUptime: boolean) => void;
  communityTheme: CommunityTheme;
  setCommunityTheme: (communityTheme: CommunityTheme) => void;
}

const StatusPageContext = createContext<StatusPageContextType | null>(null);

export function useStatusPage() {
  const context = useContext(StatusPageContext);
  if (!context) {
    throw new Error("useStatusPage must be used within a StatusPageProvider");
  }
  return context;
}

export function StatusPageProvider({
  children,
  defaultCardType = "duration",
  defaultBarType = "absolute",
  defaultShowUptime = true,
  defaultCommunityTheme = "default",
}: {
  children: React.ReactNode;
  defaultCardType?: CardType;
  defaultBarType?: BarType;
  defaultShowUptime?: boolean;
  defaultCommunityTheme?: CommunityTheme;
}) {
  const [cardType, setCardType] = useState<CardType>(defaultCardType);
  const [barType, setBarType] = useState<BarType>(defaultBarType);
  const [showUptime, setShowUptime] = useState<boolean>(defaultShowUptime);
  const [communityTheme, setCommunityTheme] = useState<CommunityTheme>(
    defaultCommunityTheme,
  );
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted) {
      recomputeStyles(communityTheme);
    }
  }, [communityTheme, isMounted]);

  return (
    <StatusPageContext.Provider
      value={{
        cardType,
        setCardType,
        barType,
        setBarType,
        showUptime,
        setShowUptime,
        communityTheme,
        setCommunityTheme,
      }}
    >
      {children}
    </StatusPageContext.Provider>
  );
}

export function FloatingButton({
  className,
  pageId,
  token,
}: {
  className?: string;
  pageId?: number;
  token?: string;
}) {
  const {
    cardType,
    setCardType,
    barType,
    setBarType,
    showUptime,
    setShowUptime,
    communityTheme,
    setCommunityTheme,
  } = useStatusPage();
  const [display, setDisplay] = useState(false);
  const [configToken, setConfigToken] = useQueryState(
    "configuration-token",
    parseAsString,
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    const enabled =
      localStorage.getItem("configuration-token") === token ||
      configToken === token;
    const host = window.location.host;
    if (
      (host.includes("localhost") ||
        host.includes("stpg.dev") ||
        host.includes("openstatus.dev") ||
        host.includes("vercel.app")) &&
      enabled
    ) {
      setDisplay(true);
      localStorage.setItem("configuration-token", token);
    } else if (IS_DEV) {
      setDisplay(true);
    }

    if (configToken) setConfigToken(null);
  }, [token]);

  if (!display) return null;

  return (
    <div className={cn("fixed right-4 bottom-4 z-50", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            size="icon"
            variant="secondary"
            className="size-12 rounded-full border"
          >
            <Settings className="size-5" />
            <span className="sr-only">Open status page settings</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="end">
          <div className="space-y-4 p-4">
            <div className="space-y-2">
              <h4 className="font-medium leading-none">Status Page Settings</h4>
              <p className="text-muted-foreground text-sm">
                Configure the status page appearance
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bar-type">Bar Type</Label>
                <Select
                  value={barType}
                  onValueChange={(v) => {
                    setBarType(v as BarType);
                    if (v !== "absolute") {
                      setCardType(v as CardType);
                    } else {
                      setCardType("requests");
                    }
                  }}
                >
                  <SelectTrigger id="bar-type" className="w-full capitalize">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BAR_TYPE.map((v) => (
                      <SelectItem key={v} value={v} className="capitalize">
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="card-type">Card Type</Label>
                <Select
                  value={cardType}
                  onValueChange={(v) => setCardType(v as CardType)}
                  disabled={barType !== "absolute"}
                >
                  <SelectTrigger id="card-type" className="w-full capitalize">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CARD_TYPE.map((v) => (
                      <SelectItem
                        key={v}
                        value={v}
                        className="capitalize"
                        disabled={["dominant", "manual"].includes(v)}
                      >
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="show-uptime">Show Uptime</Label>
                <Select
                  value={showUptime ? "true" : "false"}
                  onValueChange={(v) => setShowUptime(v === "true")}
                >
                  <SelectTrigger id="show-uptime" className="w-full capitalize">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["true", "false"].map((v) => (
                      <SelectItem key={v} value={v} className="capitalize">
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="theme">Theme</Label>
                <ThemeSelect id="theme" className="w-full" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="community-theme">Community Theme</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="community-theme"
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between font-normal"
                    >
                      <span className="truncate">
                        {THEMES[communityTheme].name}
                      </span>
                      <ChevronsUpDown className="opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0">
                    <Command>
                      <CommandInput
                        placeholder="Search themes..."
                        className="h-9"
                      />
                      <CommandList>
                        <CommandEmpty>No themes found.</CommandEmpty>
                        <CommandGroup>
                          {COMMUNITY_THEME.map((theme) => (
                            <CommandItem
                              value={theme}
                              key={theme}
                              onSelect={(v) =>
                                setCommunityTheme(v as CommunityTheme)
                              }
                            >
                              <span className="truncate">
                                {THEMES[theme].name}
                              </span>
                              <span className="truncate font-commit-mono text-muted-foreground text-xs">
                                by {THEMES[theme].author.name}
                              </span>
                              <Check
                                className={cn(
                                  "ml-auto",
                                  theme === communityTheme
                                    ? "opacity-100"
                                    : "opacity-0",
                                )}
                              />
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
          <Separator />
          <div className="p-4">
            <Button className="w-full" size="sm" asChild>
              <a
                href={
                  pageId
                    ? `https://app.openstatus.dev/status-pages/${pageId}/edit?type=${barType}&value=${cardType}&uptime=${showUptime}&theme=${communityTheme}`
                    : "https://app.openstatus.dev/status-pages"
                }
                target="_blank"
                rel="noreferrer"
              >
                Save Configuration
              </a>
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function recomputeStyles(newTheme: CommunityTheme) {
  // FIXME: only on prod, we have two style elements with the same id
  // we need to get rid of all of them except the one we want to update
  const allThemeStyles = document.querySelectorAll("style[id='theme-styles']");
  allThemeStyles.forEach((style, index) => {
    if (index === 0) {
      style.textContent = generateThemeStyles(newTheme);
    } else {
      style.remove();
    }
  });
}
