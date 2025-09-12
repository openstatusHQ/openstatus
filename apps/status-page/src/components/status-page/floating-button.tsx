"use client";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
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
import { Settings } from "lucide-react";
import { useTheme } from "next-themes";
import type React from "react";
import { createContext, useContext, useEffect, useState } from "react";
import { THEMES } from "./community-themes";

export const VARIANT = ["success", "degraded", "error", "info"] as const;
export type VariantType = (typeof VARIANT)[number];

export const CARD_TYPE = [
  "duration",
  "requests",
  "dominant",
  "manual",
] as const;
export type CardType = (typeof CARD_TYPE)[number];

export const BAR_TYPE = ["absolute", "dominant", "manual"] as const;
export type BarType = (typeof BAR_TYPE)[number];

export const COMMUNITY_THEME = ["default", "github", "supabase"] as const;
export type CommunityTheme = (typeof COMMUNITY_THEME)[number];

interface StatusPageContextType {
  variant: VariantType;
  setVariant: (variant: VariantType) => void;
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
  defaultVariant = "success",
  defaultCardType = "duration",
  defaultBarType = "absolute",
  defaultShowUptime = true,
  defaultCommunityTheme = "default",
}: {
  children: React.ReactNode;
  defaultVariant?: VariantType;
  defaultCardType?: CardType;
  defaultBarType?: BarType;
  defaultShowUptime?: boolean;
  defaultCommunityTheme?: CommunityTheme;
}) {
  const [variant, setVariant] = useState<VariantType>(defaultVariant);
  const [cardType, setCardType] = useState<CardType>(defaultCardType);
  const [barType, setBarType] = useState<BarType>(defaultBarType);
  const [showUptime, setShowUptime] = useState<boolean>(defaultShowUptime);
  const { resolvedTheme } = useTheme();
  const [communityTheme, setCommunityTheme] = useState<CommunityTheme>(
    defaultCommunityTheme,
  );

  useEffect(() => {
    const theme = resolvedTheme as "dark" | "light";
    if (["dark", "light"].includes(theme)) {
      Object.keys(THEMES[communityTheme][theme]).forEach((key) => {
        const element = document.documentElement;
        const value =
          THEMES[communityTheme][theme][
            key as keyof (typeof THEMES)[typeof communityTheme][typeof theme]
          ];
        if (value) {
          element.style.setProperty(key, value as string);
        }
      });
    }
    if (communityTheme === "default") {
      document.documentElement.removeAttribute("style");
    }
  }, [resolvedTheme, communityTheme]);

  return (
    <StatusPageContext.Provider
      value={{
        variant,
        setVariant,
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
      <div
        style={
          communityTheme
            ? THEMES[communityTheme][resolvedTheme as "dark" | "light"]
            : undefined
        }
      >
        {children}
      </div>
    </StatusPageContext.Provider>
  );
}

export function FloatingButton({ className }: { className?: string }) {
  const {
    variant,
    setVariant,
    cardType,
    setCardType,
    barType,
    setBarType,
    showUptime,
    setShowUptime,
    communityTheme,
    setCommunityTheme,
  } = useStatusPage();

  return (
    <div className={cn("fixed right-4 bottom-4 z-50 bg-background", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            size="icon"
            variant="outline"
            className="size-12 rounded-full"
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
                <Label htmlFor="status-variant">Status Variant</Label>
                <Select
                  value={variant}
                  onValueChange={(v) => setVariant(v as VariantType)}
                >
                  <SelectTrigger
                    id="status-variant"
                    className="w-full capitalize"
                    disabled
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VARIANT.map((v) => (
                      <SelectItem key={v} value={v} className="capitalize">
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
                <Label htmlFor="theme">Theme</Label>
                <ThemeToggle id="theme" className="w-full" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="community-theme">Community Theme</Label>
                <Select
                  value={communityTheme}
                  onValueChange={(v) => setCommunityTheme(v as CommunityTheme)}
                >
                  <SelectTrigger
                    id="community-theme"
                    className="w-full capitalize"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMUNITY_THEME.map((v) => (
                      <SelectItem key={v} value={v} className="capitalize">
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <Separator />
          <div className="p-4">
            <Button className="w-full" size="sm" asChild>
              <a
                href="https://github.com/openstatusHQ/openstatus-template"
                target="_blank"
                rel="noreferrer"
              >
                GitHub Repo
              </a>
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
