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
    title: "Endpoints",
    description: "Keep track of all your endpoints.",
    href: "/endpoint",
    icon: "link",
  },
  {
    title: "Monitors",
    description: "Check all the responses in one place.",
    href: "/monitor",
    icon: "activity",
  },
  {
    title: "Pages",
    description: "Wher you can see all the pages.",
    href: "/page",
    icon: "panel-top",
  },
  {
    title: "Incidents",
    description: "War room where you handle the incidents.",
    href: "/incident",
    icon: "siren",
    disabled: true,
  },
  // ...
] satisfies Page[];
