import { DiscordIcon, GitHubIcon } from "@openstatus/icons";
import { Book, Braces, CalendarClock, LifeBuoy } from "lucide-react";
import type * as React from "react";

// Lucide icons and the custom brand icons both accept svg props.
export type HelpIcon = React.ComponentType<React.ComponentProps<"svg">>;

// Single source of truth for the Get Help menu (sidebar nav-help) and the
// command-menu "Get Help" group so their icons stay in sync.
export const HELP_SUPPORT = {
  label: "Support",
  icon: LifeBuoy as HelpIcon,
  keywords: ["feedback", "help", "contact"],
};

export type HelpLink = {
  label: string;
  href: string;
  icon: HelpIcon;
  keywords?: string[];
};

export const HELP_LINKS = [
  {
    label: "Docs",
    href: "https://www.openstatus.dev/docs",
    icon: Book,
    keywords: ["documentation"],
  },
  {
    label: "API Reference",
    href: "https://api.openstatus.dev/openapi",
    icon: Braces,
    keywords: ["openapi", "swagger"],
  },
  {
    label: "Book a Call",
    href: "https://openstatus.dev/cal",
    icon: CalendarClock,
    keywords: ["demo", "meeting"],
  },
  {
    label: "Community",
    href: "https://openstatus.dev/discord",
    icon: DiscordIcon,
    keywords: ["discord", "chat"],
  },
  {
    label: "GitHub",
    href: "https://openstatus.dev/github",
    icon: GitHubIcon,
    keywords: ["source", "repo", "issues"],
  },
] satisfies HelpLink[];
