import type { ValidIcon } from "@/components/icons";

type Page = {
  title: string;
  description: string;
  href: string;
  icon: ValidIcon;
  disabled?: boolean;
};

// TODO: add to <Header id="dashboard" /> to easily access title and description - ideally allow both
export const pagesConfig: Page[] = [
  {
    title: "Monitors",
    description: "Check all the responses in one place.",
    href: "/monitors",
    icon: "activity",
  },
  {
    title: "Status Pages",
    description: "Wher you can see all the pages.",
    href: "/status-pages",
    icon: "panel-top",
  },
  {
    title: "Notifications",
    description: "Where you can see all the notifications.",
    href: "/notifications",
    icon: "bell",
  },
  {
    title: "Incidents",
    description: "War room where you handle the incidents.",
    href: "/incidents",
    icon: "siren",
  },
  {
    title: "Integrations",
    description: "Where you can see all the integrations.",
    href: "/integrations",
    icon: "plug",
  },
  // ...
];
