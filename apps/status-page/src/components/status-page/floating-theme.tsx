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
import { cn } from "@/lib/utils";
import { THEMES, THEME_KEYS } from "@openstatus/theme-store";
import { Palette } from "lucide-react";
import { useEffect } from "react";
import { useState } from "react";
import { useStatusPage } from "./floating-button";

export const COMMUNITY_THEME = THEME_KEYS;
export type CommunityTheme = (typeof COMMUNITY_THEME)[number];

export function FloatingTheme({ className }: { className?: string }) {
  const { communityTheme, setCommunityTheme } = useStatusPage();
  const [display, setDisplay] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const enabled = sessionStorage.getItem("community-theme") === "true";
    const host = window.location.host;
    if (
      (host.includes("localhost") ||
        host.includes("stpg.dev") ||
        host.includes("openstatus.dev") ||
        host.includes("vercel.app")) &&
      enabled
    ) {
      setDisplay(true);
      setOpen(true);
    }
  }, []);

  if (!display) return null;

  return (
    <div className={cn("fixed right-4 bottom-4 z-50", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button size="icon" className="size-12 rounded-full">
            <Palette className="size-5" />
            <span className="sr-only">Open theme settings</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="end">
          <div className="space-y-4 p-4">
            <div className="space-y-2">
              <h4 className="font-medium leading-none">Theme Settings</h4>
              <p className="text-muted-foreground text-sm">
                Test the community themes on the status page.
              </p>
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
                  {COMMUNITY_THEME.map((theme) => (
                    <SelectItem
                      key={theme}
                      value={theme}
                      className="capitalize"
                    >
                      {THEMES[theme].name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
