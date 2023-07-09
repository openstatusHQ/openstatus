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
    href: "/app",
    icon: "layout-dashboard",
  },
  {
    title: "Endpoint",
    description: "Keep track of all your endpoints.",
    href: "/app/endpoint",
    icon: "link",
  },
  {
    title: "Monitor",
    description: "Check all the responses in one place.",
    href: "/app/monitor",
    icon: "activity",
  },
  {
    title: "Incident",
    description: "War room where you handle the incidents.",
    href: "/app/incident",
    icon: "siren",
    disabled: true,
  },
  // ...
] satisfies Page[];
