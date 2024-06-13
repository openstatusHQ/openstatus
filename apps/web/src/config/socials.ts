import type { ValidIcon } from "@/components/icons";

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
    title: "Twitter",
    href: "/twitter",
    icon: "twitter",
  },
  {
    title: "LinkedIn",
    href: "/linkedin",
    icon: "linkedin",
  },
  // {
  //   title: "YouTube",
  //   href: "/youtube",
  //   icon: "youtube",
  // },
];
