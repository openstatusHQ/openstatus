"use client";

import { Link } from "@/components/common/link";
import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";
import {
  Status,
  StatusContent,
  StatusDescription,
  StatusHeader,
  StatusTitle,
} from "@/components/status-page/status";
import { StatusBanner } from "@/components/status-page/status-banner";
import { StatusMonitor } from "@/components/status-page/status-monitor";
import { monitors } from "@/data/monitors";
import { THEMES, THEME_KEYS } from "@/lib/community-themes";
import { useTRPC } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

export default function Page() {
  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>Status Page Themes</SectionTitle>
          <SectionDescription>
            View all the current themes you can use.{" "}
            <Link href="#contribute-theme">Contribute your own?</Link>
          </SectionDescription>
        </SectionHeader>
        <div className="flex flex-col gap-4">
          {THEME_KEYS.map((theme) => {
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
          })}
        </div>
      </Section>
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
            <code>src/lib/community-themes</code> directory. Make sure your
            object is satisfiying the <code>Theme</code> interface.
          </p>
          <p>
            Go to the{" "}
            <Link href="https://github.com/openstatus-dev/status-page/blob/main/src/lib/community-themes">
              GitHub directory
            </Link>{" "}
            to see the existing themes and create a new one by forking and
            creating a pull request.
            <br /> To speed things up, ping us on GitHub (
            <Link href="https://github.com/thibaultleouay">
              @thibaultleouay
            </Link>{" "}
            and <Link href="https://github.com/mxkaske">@mxkaske</Link>) so we
            can review it.
          </p>
          <hr />
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

// TODO: the status-tracker hover card is mounted on the body and looses the theme style context

function ThemeCard({
  theme,
  mode,
}: {
  theme: keyof typeof THEMES;
  mode: "dark" | "light";
}) {
  const t = THEMES[theme][mode];
  const trpc = useTRPC();
  const { data: uptimeData, isLoading } = useQuery(
    trpc.statusPage.getNoopUptime.queryOptions(),
  );
  return (
    <div
      className={cn(
        "group/theme-card overflow-hidden rounded-lg border",
        mode === "dark" ? "dark" : "",
      )}
    >
      <div
        style={t as React.CSSProperties}
        className="h-full w-full bg-background"
      >
        {/* NOTE: we use pointer-events-none to prevent the hover card or tooltip from being interactive - the Portal container is document body and we loose the styles */}
        <div className="pointer-events-none scale-85 bg-background text-foreground transition-all duration-300 group-hover/theme-card:scale-90">
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
      </div>
    </div>
  );
}

function ThemeGroup({ children, className }: React.ComponentProps<"div">) {
  return (
    <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2", className)}>
      {children}
    </div>
  );
}

function ThemeHeader({ children, className }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col", className)}>{children}</div>;
}

function ThemeTitle({ children, className }: React.ComponentProps<"div">) {
  return (
    <div className={cn("font-semibold text-base", className)}>{children}</div>
  );
}

function ThemeAuthor({ children, className }: React.ComponentProps<"div">) {
  return (
    <div className={cn("font-mono text-muted-foreground text-xs", className)}>
      {children}
    </div>
  );
}
