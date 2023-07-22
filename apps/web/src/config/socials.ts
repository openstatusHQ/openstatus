import type { ValidIcon } from "@/components/icons";

type Social = {
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
  // add cal.com
];
