"use client";

import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";
import { THEMES } from "@/components/status-page/community-themes";
import { COMMUNITY_THEME } from "@/components/status-page/floating-button";
import {
  Status,
  StatusBanner,
  StatusContent,
  StatusDescription,
  StatusHeader,
  StatusTitle,
} from "@/components/status-page/status";
import { StatusMonitor } from "@/components/status-page/status-monitor";
import { chartData } from "@/components/status-page/utils";
import { monitors } from "@/data/monitors";
import { cn } from "@/lib/utils";

export default function Page() {
  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>Status Page Themes</SectionTitle>
          <SectionDescription>
            View all the current themes you can use. Or contribute your own one.
          </SectionDescription>
        </SectionHeader>
        <div className="flex flex-col gap-4">
          {COMMUNITY_THEME.filter((theme) => theme !== "default").map(
            (theme) => {
              const t = THEMES[theme];
              return (
                <div key={theme} className="flex flex-col gap-2">
                  <ThemeHeader>
                    <ThemeTitle>{t.name}</ThemeTitle>
                    <ThemeAuthor>
                      by{" "}
                      <a
                        href={t.author.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {t.author.name}
                      </a>
                    </ThemeAuthor>
                  </ThemeHeader>
                  <ThemeGroup>
                    <ThemeCard theme={theme} mode="light" />
                    <ThemeCard theme={theme} mode="dark" />
                  </ThemeGroup>
                </div>
              );
            },
          )}
        </div>
      </Section>
    </SectionGroup>
  );
}

// TODO: the status-tracker hover card is mounted on the body and looses the theme style context

function ThemeCard({
  theme,
  mode,
}: {
  theme: keyof typeof THEMES;
  mode: "dark" | "light";
}) {
  const t = THEMES[theme][mode];
  return (
    <div className="group/theme-card border rounded-lg overflow-hidden">
      <div
        style={{
          ...t,
        }}
        className="w-full h-full bg-background"
      >
        {/* NOTE: we use pointer-events-none to prevent the hover card or tooltip from being interactive - the Portal container is document body and we loose the styles */}
        <div className="scale-85 bg-background text-foreground pointer-events-none group-hover/theme-card:scale-90 transition-all duration-300">
          <Status variant="success">
            <StatusHeader>
              <StatusTitle>Craft</StatusTitle>
              <StatusDescription>
                Stay informed about the stability
              </StatusDescription>
            </StatusHeader>
            <StatusBanner />
            <StatusContent>
              <StatusMonitor
                variant="success"
                cardType="duration"
                barType="absolute"
                data={chartData}
                monitor={monitors[0]}
                showUptime={true}
              />
            </StatusContent>
          </Status>
        </div>
      </div>
    </div>
  );
}

function ThemeGroup({ children, className }: React.ComponentProps<"div">) {
  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-2 gap-4", className)}>
      {children}
    </div>
  );
}

function ThemeHeader({ children, className }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col", className)}>{children}</div>;
}

function ThemeTitle({ children, className }: React.ComponentProps<"div">) {
  return <div className={cn("text-base font-bold", className)}>{children}</div>;
}

function ThemeAuthor({ children, className }: React.ComponentProps<"div">) {
  return (
    <div className={cn("text-xs text-muted-foreground font-mono", className)}>
      {children}
    </div>
  );
}
