"use client";

import { Link } from "@/components/common/link";
import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionGroupHeader,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";
import { recomputeStyles } from "@/components/status-page/floating-button";
import {
  Status,
  StatusContent,
  StatusDescription,
  StatusHeader,
  StatusTitle,
} from "@/components/status-page/status";
import { StatusBanner } from "@/components/status-page/status-banner";
import { StatusMonitor } from "@/components/status-page/status-monitor";
import { ThemePalettePicker } from "@/components/themes/theme-palette-picker";
import { ThemeSelect } from "@/components/themes/theme-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { monitors } from "@/data/monitors";
import { useTRPC } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { THEMES, THEME_KEYS } from "@openstatus/theme-store";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { useQueryStates } from "nuqs";
import { useEffect, useState } from "react";
import { searchParamsParsers } from "./search-params";

const MAIN_COLORS = [
  { key: "--primary", label: "Primary" },
  { key: "--success", label: "Operational" },
  { key: "--destructive", label: "Error" },
  { key: "--warning", label: "Degraded" },
  { key: "--info", label: "Maintenance" },
] as const;

// TODO: add keyboard navigation for selection?

export function Client() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [searchParams, setSearchParams] = useQueryStates(searchParamsParsers);
  const { q, t } = searchParams;
  const theme = t ? THEMES[t as keyof typeof THEMES] : undefined;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (t) {
      recomputeStyles(t);
    }
  }, [t]);

  return (
    <SectionGroup>
      <SectionGroupHeader>
        <h1 className="font-bold text-2xl md:text-4xl">
          Status Page Theme Explorer
        </h1>
        <h2 className="font-medium text-muted-foreground md:text-lg">
          View all the openstatus themes and learn how to create your own.
        </h2>
      </SectionGroupHeader>
      <Section>
        <SectionHeader>
          <SectionTitle>Explorer</SectionTitle>
          <SectionDescription>
            Search for your favorite status page theme.{" "}
            <Link href="#contribute-theme">Contribute your own?</Link>
          </SectionDescription>
        </SectionHeader>
        <div className="sticky top-0 z-10 overflow-hidden rounded-lg border border-border bg-background outline-[3px] outline-background sm:relative">
          <div className="relative">
            <div className="absolute top-0 right-0 rounded-bl-lg border-border border-b border-l bg-muted/50 px-2 py-0.5 text-[10px]">
              {theme?.name}
            </div>
            <div className="sm:p-8">
              <ThemePlaygroundMonitor className="scale-80 sm:scale-100" />
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <ThemeSelect />
          <Input
            placeholder={`Search from ${THEME_KEYS.length} themes`}
            value={q ?? ""}
            onChange={(e) => {
              if (e.target.value.length === 0) {
                setSearchParams({ q: null });
              }
              setSearchParams({ q: e.target.value.trim().toLowerCase() });
            }}
          />
          <ThemePalettePicker />
        </div>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
          {THEME_KEYS.filter((k) => {
            const theme = THEMES[k];
            return (
              theme.author.name
                .toLowerCase()
                .includes(q?.toLowerCase() ?? "") ||
              theme.name.toLowerCase().includes(q?.toLowerCase() ?? "")
            );
          }).map((k) => {
            const theme = THEMES[k];
            const style = mounted
              ? theme[resolvedTheme as "dark" | "light"]
              : undefined;

            return (
              <li key={k} className="group/theme-card space-y-1.5">
                <div
                  data-active={k === t}
                  data-slot="theme-card"
                  data-theme={k}
                  className="relative h-40 cursor-pointer overflow-hidden rounded-md border outline-none transition-all focus:outline-ring/50 focus:ring-2 focus:ring-ring/50 data-[active=true]:border-ring data-[active=true]:outline-[3px] data-[active=true]:outline-ring/50"
                  onClick={() => setSearchParams({ t: k })}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      setSearchParams({ t: k });
                    }
                  }}
                >
                  {mounted ? (
                    <div
                      className="absolute h-full w-full bg-background text-foreground"
                      style={style as React.CSSProperties}
                      inert
                    >
                      <ThemePlaygroundMonitor className="pointer-events-none scale-80" />
                    </div>
                  ) : (
                    <Skeleton className="absolute h-full w-full" />
                  )}
                </div>
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="font-medium text-foreground text-sm leading-none">
                      {theme.name}
                    </div>
                    <div className="font-mono text-xs">
                      <Link
                        href={theme.author.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground"
                      >
                        by {theme.author.name}
                      </Link>
                    </div>
                  </div>
                  <div className="flex gap-0.5">
                    {MAIN_COLORS.map((color) => {
                      const backgroundColor = style
                        ? style[color.key]
                        : undefined;

                      if (!mounted) {
                        return (
                          <Skeleton
                            key={color.key}
                            className="size-3.5 rounded-sm"
                          />
                        );
                      }
                      return (
                        <TooltipProvider key={color.key}>
                          <Tooltip>
                            <TooltipTrigger>
                              <div
                                className="size-3.5 rounded-sm border bg-muted-foreground"
                                style={{ backgroundColor }}
                              />
                            </TooltipTrigger>
                            <TooltipContent>{color.label}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      );
                    })}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </Section>
      <Separator />
      <Section>
        <SectionHeader id="contribute-theme">
          <SectionTitle>Contribute Theme</SectionTitle>
          <SectionDescription>
            Contribute your own theme to the community.
          </SectionDescription>
        </SectionHeader>
        <div className="prose dark:prose-invert prose-sm max-w-none">
          <p>
            You can contribute your own theme by creating a new file in the{" "}
            <code>@openstatus.theme-store</code> package. You&apos;ll only need
            to override css variables. If you are familiar with shadcn, you'll
            know the trick (it also allows you to override `--radius`). Make
            sure your object is satisfying the <code>Theme</code> interface.
          </p>
          <p>
            Go to the{" "}
            <Link href="https://github.com/openstatusHQ/openstatus/tree/main/packages/theme-store">
              GitHub directory
            </Link>{" "}
            to see the existing themes and create a new one by forking and
            creating a pull request.
          </p>
          <Button
            onClick={() => {
              // NOTE: we use it to display the 'floating-theme' component
              sessionStorage.setItem("community-theme", "true");
              window.location.href = "/status";
            }}
          >
            Test it
          </Button>
          {/* TODO: OR go to the status-page config and click on the View and Configure button */}
          <p>
            Or use the{" "}
            <code>sessionStorage.setItem("community-theme", "true");</code> on
            your own status page.
          </p>
        </div>
      </Section>
      <Separator />
      <Section>
        <div className="prose dark:prose-invert prose-sm max-w-none">
          <blockquote>
            Ideally, we would allow you to customize your theme with a{" "}
            <code>ThemePalettePicker</code> component to easily test and export
            your theme. Contributions are welcome!
          </blockquote>
          <p>
            Why don't we allow custom css styles to be overridden and only
            support themes?
          </p>
          <ul>
            <li>Keep it simple for the user</li>
            <li>Don't end up with a xmas tree</li>
            <li>Keep the theme consistent</li>
            <li>Avoid conflicts with other styles</li>
            <li>
              Keep the theme maintainable (but this will also mean, a change
              will affect all users)
            </li>
          </ul>
        </div>
      </Section>
    </SectionGroup>
  );
}

function ThemePlaygroundMonitor({
  className,
  ...props
}: React.ComponentProps<"div"> & {}) {
  const trpc = useTRPC();
  const { data: uptimeData, isLoading } = useQuery(
    trpc.statusPage.getNoopUptime.queryOptions(),
  );
  return (
    // NOTE: we use pointer-events-none to prevent the hover card or tooltip from being interactive - the Portal container is document body and we loose the styles
    <div className={cn("h-full w-full", className)} {...props}>
      <Status variant="success">
        <StatusHeader>
          <StatusTitle>Acme Inc.</StatusTitle>
          <StatusDescription>
            Get informed about our services.
          </StatusDescription>
        </StatusHeader>
        <StatusBanner status="success" />
        <StatusContent>
          {/* TODO: create mock data */}
          <StatusMonitor
            status="success"
            data={uptimeData?.data || []}
            monitor={monitors[0]}
            showUptime={true}
            uptime={uptimeData?.uptime}
            isLoading={isLoading}
          />
        </StatusContent>
      </Status>
    </div>
  );
}
