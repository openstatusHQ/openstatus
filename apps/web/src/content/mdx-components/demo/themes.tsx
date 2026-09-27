"use client";

import { THEME_KEYS, THEMES } from "@openstatus/theme-store";
import { StatusBar } from "@openstatus/ui/components/blocks/status-bar";
import {
  StatusComponent,
  StatusComponentBody,
  StatusComponentFooter,
  StatusComponentHeader,
  StatusComponentHeaderLeft,
  StatusComponentHeaderRight,
  StatusComponentIcon,
  StatusComponentStatus,
  StatusComponentTitle,
  StatusComponentUptime,
} from "@openstatus/ui/components/blocks/status-component";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@openstatus/ui/components/ui/dropdown-menu";
import { useState } from "react";

import { demo, getMonitors, getStatusBarData } from "@/data/demo-data";

import { Cell, CellBody, CellFooter, CellHeader, CellTitle } from "./cell";
import { DemoBanner } from "./status-blocks";

// The default theme is the page above; open on a store theme instead.
const DEFAULT_THEME = "supabase";

function scopedVars(vars: Record<string, string>) {
  return Object.entries(vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
}

function themeCss(id: string) {
  const theme = THEMES[id];
  // Matches the app's @custom-variant dark (&:is(.dark *)).
  return `[data-demo-theme="${id}"]{${scopedVars(theme.light)}}.dark [data-demo-theme="${id}"]{${scopedVars(theme.dark)}}`;
}

/** Same blocks, re-skinned by the CSS tokens each store theme sets. */
export function ThemesDemo() {
  const [theme, setTheme] = useState<string>(DEFAULT_THEME);
  // The bar's hover card portals to body by default, outside the themed subtree.
  const [scope, setScope] = useState<HTMLDivElement | null>(null);
  const monitor = getMonitors()[0];
  const data = getStatusBarData(monitor);
  return (
    <>
      <style>{THEME_KEYS.map(themeCss).join("")}</style>
      <Cell>
        <CellHeader>
          <CellTitle>{demo.company.domain}</CellTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="-my-1 -mr-2">
                {THEMES[theme].name}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                {THEME_KEYS.map((id) => (
                  <DropdownMenuItem key={id} onClick={() => setTheme(id)}>
                    {THEMES[id].name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </CellHeader>
        <CellBody>
          {/* Scope the theme below the body so the Cell's own rule keeps the page border color. */}
          <div
            ref={setScope}
            data-demo-theme={theme}
            className="text-foreground flex flex-col gap-4"
          >
            <DemoBanner status={monitor.status} />
            <StatusComponent variant={monitor.status}>
              <StatusComponentHeader>
                <StatusComponentHeaderLeft>
                  <StatusComponentIcon />
                  <StatusComponentTitle>{monitor.name}</StatusComponentTitle>
                </StatusComponentHeaderLeft>
                <StatusComponentHeaderRight>
                  <StatusComponentUptime>
                    {monitor.uptime}
                  </StatusComponentUptime>
                  <StatusComponentStatus />
                </StatusComponentHeaderRight>
              </StatusComponentHeader>
              <StatusComponentBody>
                <StatusBar data={data} container={scope} />
                <StatusComponentFooter data={data} />
              </StatusComponentBody>
            </StatusComponent>
          </div>
        </CellBody>
        <CellFooter>
          <span>Domain {demo.company.domain} · verified</span>
          <span>--success · --warning · --primary · --radius</span>
        </CellFooter>
      </Cell>
    </>
  );
}
