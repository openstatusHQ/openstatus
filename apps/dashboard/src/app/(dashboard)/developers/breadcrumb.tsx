"use client";

import { Code } from "@openstatus/icons";
import { usePathname } from "next/navigation";

import { NavBreadcrumb } from "@/components/nav/nav-breadcrumb";

import { DEVELOPER_TABS } from "./constants";

export function Breadcrumb() {
  const pathname = usePathname();
  const segment = pathname.split("/").pop() ?? "";
  const currentTab = DEVELOPER_TABS.find((tab) => tab.value === segment);

  return (
    <NavBreadcrumb
      items={[
        {
          type: "link",
          label: "Developers",
          href: "/developers/api-keys",
          icon: Code,
        },
        ...(currentTab
          ? [
              {
                type: "page" as const,
                label: currentTab.label,
                icon: currentTab.icon,
              },
            ]
          : []),
      ]}
    />
  );
}
