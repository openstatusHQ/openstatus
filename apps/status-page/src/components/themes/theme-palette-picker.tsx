"use client";

import { useSidebar } from "@/components/ui/sidebar";
import { Palette } from "lucide-react";
import { Button } from "../ui/button";

export function ThemePalettePicker() {
  const { toggleSidebar } = useSidebar();
  return (
    <Button size="icon" variant="outline" onClick={toggleSidebar}>
      <Palette className="size-4" />
    </Button>
  );
}
