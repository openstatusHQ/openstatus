"use client";

// Canonical reference for the composition this mirrors:
//   apps/status-page/src/app/(status-page)/[domain]/[locale]/(public)/layout.tsx
//   apps/status-page/src/components/nav/header.tsx
//
// We intentionally do NOT extract a shared `<StatusPagePreview>` block — the
// real status page wires next/link nav, the email-subscribe form, locale
// switcher, password gate, status-fetcher, etc., and forcing those through
// slot props would turn the shared block into a configuration soup. The
// onboarding preview only needs visual chrome, so we compose the leaf blocks
// directly. When a leaf-block API changes, both consumers feel it; if the
// canonical composition reshuffles, update this file by hand against the
// reference above.

import { cn } from "@/lib/utils";
import {
  THEMES,
  type ThemeKey,
  type ThemeMode,
  type ThemeVars,
} from "@openstatus/theme-store";
import { StatusBanner } from "@openstatus/ui/components/blocks/status-banner";
import { StatusBar } from "@openstatus/ui/components/blocks/status-bar";
import {
  StatusComponent,
  StatusComponentBody,
  StatusComponentHeader,
  StatusComponentHeaderLeft,
  StatusComponentHeaderRight,
  StatusComponentIcon,
  StatusComponentTitle,
  StatusComponentUptime,
} from "@openstatus/ui/components/blocks/status-component";
import { StatusFeed } from "@openstatus/ui/components/blocks/status-feed";
import {
  Status,
  StatusContent,
  StatusDescription,
  StatusHeader,
  StatusTitle,
} from "@openstatus/ui/components/blocks/status-layout";
import {
  StatusPageHeader,
  StatusPageHeaderActions,
  StatusPageHeaderBrand,
  StatusPageHeaderBrandFallback,
  StatusPageHeaderContent,
} from "@openstatus/ui/components/blocks/status-page-header";
import {
  StatusPageMain,
  StatusPageShell,
} from "@openstatus/ui/components/blocks/status-page-shell";
import type { StatusBarData } from "@openstatus/ui/components/blocks/status.types";
import { Separator } from "@openstatus/ui/components/ui/separator";
import { Skeleton } from "@openstatus/ui/components/ui/skeleton";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useRef, useState } from "react";

// 45 days of all-green placeholder data so the bars render solid instead of
// loading-skeleton on first paint. The user has no real history yet — this is
// "what the page will look like once data flows in," matching what every demo
// status page looks like the day it ships. Built per-mount (via useState
// initializer below) so the window stays current across long-lived sessions.
function buildPlaceholderBarData(): StatusBarData[] {
  return Array.from({ length: 45 }, (_, i) => {
    const day = new Date();
    day.setDate(day.getDate() - (44 - i));
    const iso = day.toISOString().slice(0, 10);
    return {
      day: iso,
      bar: [{ status: "success", height: 100 }],
      card: [{ status: "success", value: "100%" }],
      events: [],
    };
  });
}

export type OnboardingStatusPagePreviewProps = {
  slug: string;
  title?: string;
  description?: string;
  components: { name: string }[];
  monitorName?: string | null;
  themeKey: ThemeKey;
  className?: string;
};

export function OnboardingStatusPagePreview({
  slug,
  title,
  description,
  components,
  monitorName,
  themeKey,
  className,
}: OnboardingStatusPagePreviewProps) {
  const { resolvedTheme } = useTheme();
  const mode: ThemeMode = resolvedTheme === "dark" ? "dark" : "light";

  // Single mount flag drives:
  //   1. `useThemeVars` mode resolution (next-themes only resolves `system`
  //      client-side, so SSR uses light and we settle on mount).
  //   2. `<StatusBar container>` — `previewRef.current` is null on the first
  //      render, so we wait until after mount before handing the ref to the
  //      Radix portal. Reading `mounted` in the JSX makes the dependency
  //      explicit instead of relying on a render side-effect.
  const previewRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const themeStyle = useThemeVars(themeKey, mode, mounted);
  const [placeholderBarData] = useState(buildPlaceholderBarData);

  const displayTitle = title?.trim() || slug || "My Status Page";
  const allComponents: { key: string; name: string }[] = [
    ...(monitorName ? [{ key: "__monitor", name: monitorName }] : []),
    ...components
      .filter((c) => c.name.trim().length > 0)
      .map((c, i) => ({ key: `c-${i}`, name: c.name })),
  ];

  if (!mounted) {
    return (
      <Skeleton className={cn("rounded-md border border-border", className)} />
    );
  }

  return (
    <div
      ref={previewRef}
      data-status-preview
      style={themeStyle}
      className={cn(
        "flex flex-col overflow-y-auto rounded-md border border-border bg-background text-foreground",
        className,
      )}
    >
      <StatusPageShell className="min-h-0 shrink-0">
        <StatusPageHeader className="w-full border-border border-b">
          <StatusPageHeaderContent>
            <StatusPageHeaderBrand>
              <div className="flex size-8 items-center justify-center overflow-hidden rounded-md border border-border bg-background">
                <StatusPageHeaderBrandFallback title={displayTitle} />
              </div>
            </StatusPageHeaderBrand>
            <StatusPageHeaderActions />
          </StatusPageHeaderContent>
        </StatusPageHeader>
        <StatusPageMain>
          <Status variant="success" className="gap-6">
            <StatusHeader>
              <StatusTitle>{displayTitle}</StatusTitle>
              {description ? (
                <StatusDescription>{description}</StatusDescription>
              ) : null}
            </StatusHeader>
            <StatusBanner status="success" />
            <StatusContent>
              {allComponents.map((c) => (
                <StatusComponent key={c.key} variant="success">
                  <StatusComponentHeader>
                    <StatusComponentHeaderLeft>
                      <StatusComponentTitle>{c.name}</StatusComponentTitle>
                    </StatusComponentHeaderLeft>
                    <StatusComponentHeaderRight>
                      <StatusComponentUptime>100%</StatusComponentUptime>
                      <StatusComponentIcon />
                    </StatusComponentHeaderRight>
                  </StatusComponentHeader>
                  <StatusComponentBody>
                    <StatusBar
                      data={placeholderBarData}
                      container={mounted ? previewRef.current : null}
                    />
                  </StatusComponentBody>
                </StatusComponent>
              ))}
            </StatusContent>
            <Separator />
            <StatusContent>
              <StatusFeed statusReports={[]} maintenances={[]} />
            </StatusContent>
          </Status>
        </StatusPageMain>
      </StatusPageShell>
    </div>
  );
}

// Inline `style` (not a `<style>` tag with `:root`) keeps the palette
// contained to this subtree — the surrounding dashboard keeps its own theme.
// `next-themes` resolves `system` only on the client, so SSR uses light and
// the caller settles to the resolved mode after mount via the `mounted` flag.
//
// `--radius: 0rem` mirrors `apps/status-page/src/app/globals.css:21` — the
// status-page app forces a flat baseline so square corners are the default
// and only `OPENSTATUS_ROUNDED_THEME` (which sets its own `--radius`) goes
// curved. Without this baseline, the preview inherits the dashboard's
// `--radius: 0.625rem` and every theme renders rounded.
function useThemeVars(themeKey: ThemeKey, mode: ThemeMode, mounted: boolean) {
  return useMemo<React.CSSProperties>(() => {
    const theme = THEMES[themeKey] ?? THEMES.default;
    const vars: ThemeVars =
      mounted && mode === "dark" ? theme.dark : theme.light;
    return {
      "--radius": "0rem",
      ...vars,
    } as React.CSSProperties;
  }, [themeKey, mode, mounted]);
}
