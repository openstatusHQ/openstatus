"use client";

import { THEME_KEYS, THEMES } from "@openstatus/theme-store";
import {
  StatusBannerContainer,
  StatusBannerIcon,
  StatusBannerMessage,
} from "@openstatus/ui/components/blocks/status-banner";
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

import { demo, getStatusBarData } from "@/data/demo-data";

import { Cell, CellBody, CellFooter, CellHeader, CellTitle } from "./cell";

// The default theme is the page above; open on a store theme instead.
const DEFAULT_THEME = "supabase";

function scopedVars(vars: Record<string, string>) {
  return Object.entries(vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
}

function themeCss(id: string) {
  const theme = THEMES[id];
  return `[data-demo-theme="${id}"]{${scopedVars(theme.light)}}.dark [data-demo-theme="${id}"]{${scopedVars(theme.dark)}}`;
}

/** Same blocks, re-skinned by the CSS tokens each store theme sets. */
export function ThemesDemo() {
  const [theme, setTheme] = useState<string>(DEFAULT_THEME);
  const monitor = demo.components.find((c) => !c.external && c.degradedDays);
  if (!monitor) return null;
  const data = getStatusBarData(monitor.degradedDays);
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
            data-demo-theme={theme}
            className="text-foreground flex flex-col gap-4"
          >
            <StatusBannerContainer
              status={monitor.status}
              className="flex items-center gap-3 px-3 py-2"
            >
              <StatusBannerIcon className="shrink-0" />
              <StatusBannerMessage className="font-semibold" />
            </StatusBannerContainer>
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
                <StatusBar data={data} />
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
