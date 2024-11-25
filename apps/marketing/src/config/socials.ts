import type { ValidIcon } from "@openstatus/ui";

export type Social = {
  title: string;
  href: string;
  icon: ValidIcon;
};

export const socialsConfig: Social[] = [
  {
    title: "Discord",
    href: "/discord",
    icon: "discord",
  },
  {
    title: "GitHub",
    href: "/github",
    icon: "github",
  },
  {
    title: "Bluesky",
    href: "/bluesky",
    icon: "bluesky",
  },
  {
    title: "Twitter",
    href: "/twitter",
    icon: "twitter",
  },
  {
    title: "LinkedIn",
    href: "/linkedin",
    icon: "linkedin",
  },
];
