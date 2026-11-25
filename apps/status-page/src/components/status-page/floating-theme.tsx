"use client";

import { Check, Close, Expand, Theme } from "@openstatus/icons";
import { THEMES, THEME_KEYS } from "@openstatus/theme-store";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@openstatus/ui/components/ui/command";
import { Label } from "@openstatus/ui/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@openstatus/ui/components/ui/popover";
import { cn } from "@openstatus/ui/lib/utils";
import { useEffect } from "react";
import { useState } from "react";

import { clearThemeDraft, readThemeDraft } from "../../lib/theme-draft";
import { ThemeSelect } from "../themes/theme-select";
import { useStatusPage } from "./floating-button";

export const COMMUNITY_THEME = THEME_KEYS;
export type CommunityTheme = (typeof COMMUNITY_THEME)[number];

export function FloatingTheme({ className }: { className?: string }) {
  const { communityTheme, setCommunityTheme, draftTheme, setDraftTheme } =
    useStatusPage();
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
      setDraftTheme(readThemeDraft());
    }
  }, [setDraftTheme]);

  function discardDraft() {
    clearThemeDraft();
    setDraftTheme(null);
  }

  if (!display) return null;

  return (
    <div className={cn("fixed right-4 bottom-4 z-50", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button size="icon" className="size-12 rounded-full">
            <Theme className="size-5" />
            <span className="sr-only">Open theme settings</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="end">
          <div className="space-y-4 p-4">
            <div className="space-y-2">
              <h4 className="leading-none font-medium">Theme Settings</h4>
              <p className="text-muted-foreground text-sm">
                Test community themes on the status page.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="theme">Theme Mode</Label>
              <ThemeSelect id="theme" className="w-full" />
            </div>
            {draftTheme ? (
              <div className="space-y-2">
                <Label>Draft</Label>
                <div className="border-border flex items-center justify-between gap-2 rounded-md border px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm">{draftTheme.name}</div>
                    <div className="text-muted-foreground truncate font-mono text-xs">
                      {draftTheme.id}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0"
                    onClick={discardDraft}
                  >
                    <Close className="size-4" />
                    <span className="sr-only">Discard draft</span>
                  </Button>
                </div>
                <p className="text-muted-foreground text-xs">
                  Previewing the theme from the builder. Discard it to switch
                  between community themes.
                </p>
              </div>
            ) : (
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
                      <Expand className="opacity-50" />
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
                              <span className="font-commit-mono text-muted-foreground truncate text-xs">
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
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
