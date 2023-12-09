"use client";

import * as React from "react";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";

export default function AppearancePage() {
  const { setTheme, theme } = useTheme();

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
      <button onClick={() => setTheme("light")}>
        <LightModeCard active={theme === "light"} />
        <span className="text-muted-foreground mt-2 text-sm font-light">
          Light
        </span>
      </button>
      <button onClick={() => setTheme("dark")}>
        <DarkModeCard active={theme === "dark"} />
        <span className="text-muted-foreground mt-2 text-sm font-light">
          Dark
        </span>
      </button>
      <button onClick={() => setTheme("system")}>
        <div className="relative">
          <LightModeCard active={theme === "system"} />
          <div
            className="absolute bottom-0 left-0 right-0 top-0"
            style={{
              clipPath: "polygon(100% 0, 0 0, 100% 100%)",
            }}
          >
            <DarkModeCard active={theme === "system"} />
          </div>
        </div>
        <span className="text-muted-foreground mt-2 text-sm font-light">
          System
        </span>
      </button>
    </div>
  );
}

function LightModeCard({ active }: { active: boolean }) {
  return (
    <div
      className={cn(
        "border-muted items-center rounded-md border-2 p-1",
        active && "ring-ring ring-offset-background ring-2 ring-offset-2",
      )}
    >
      <div className="space-y-2 rounded-sm bg-[#ecedef] p-2">
        <div className="space-y-2 rounded-md bg-white p-2 shadow-sm">
          <div className="h-2 w-[80px] rounded-lg bg-[#ecedef]" />
          <div className="h-2 w-[100px] rounded-lg bg-[#ecedef]" />
        </div>
        <div className="flex items-center space-x-2 rounded-md bg-white p-2 shadow-sm">
          <div className="h-4 w-4 rounded-full bg-[#ecedef]" />
          <div className="h-2 w-[100px] rounded-lg bg-[#ecedef]" />
        </div>
        <div className="flex items-center space-x-2 rounded-md bg-white p-2 shadow-sm">
          <div className="h-4 w-4 rounded-full bg-[#ecedef]" />
          <div className="h-2 w-[100px] rounded-lg bg-[#ecedef]" />
        </div>
      </div>
    </div>
  );
}

function DarkModeCard({ active }: { active: boolean }) {
  return (
    <div
      className={cn(
        "border-muted bg-popover items-center rounded-md border-2 p-1",
        active && "ring-ring ring-offset-background ring-2 ring-offset-2",
      )}
    >
      <div className="space-y-2 rounded-sm bg-slate-950 p-2">
        <div className="space-y-2 rounded-md bg-slate-800 p-2 shadow-sm">
          <div className="h-2 w-[80px] rounded-lg bg-slate-400" />
          <div className="h-2 w-[100px] rounded-lg bg-slate-400" />
        </div>
        <div className="flex items-center space-x-2 rounded-md bg-slate-800 p-2 shadow-sm">
          <div className="h-4 w-4 rounded-full bg-slate-400" />
          <div className="h-2 w-[100px] rounded-lg bg-slate-400" />
        </div>
        <div className="flex items-center space-x-2 rounded-md bg-slate-800 p-2 shadow-sm">
          <div className="h-4 w-4 rounded-full bg-slate-400" />
          <div className="h-2 w-[100px] rounded-lg bg-slate-400" />
        </div>
      </div>
    </div>
  );
}
