"use client";

import { Theme } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import { Kbd, KbdGroup } from "@openstatus/ui/components/ui/kbd";
import { useSidebar } from "@openstatus/ui/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@openstatus/ui/components/ui/tooltip";

export function ThemePalettePicker() {
  const { toggleSidebar } = useSidebar();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button size="icon" variant="outline" onClick={toggleSidebar}>
          <Theme className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent className="flex items-center gap-2">
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
