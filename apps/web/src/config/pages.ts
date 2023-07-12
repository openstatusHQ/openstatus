import type { ValidIcon } from "@/components/icons";

type Page = {
  title: string;
  description: string;
  href: string;
  icon: ValidIcon;
  disabled?: boolean;
};

export const pagesConfig = [
  {
    title: "Dashboard",
    description: "Get an overview of what's hot.",
    href: "",
    icon: "layout-dashboard",
  },

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
    title: "Incidents",
    description: "War room where you handle the incidents.",
    href: "/incidents",
    icon: "siren",
  },
  // ...
] satisfies Page[];
