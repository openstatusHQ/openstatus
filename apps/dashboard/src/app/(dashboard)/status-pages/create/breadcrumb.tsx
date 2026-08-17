"use client";

import { StatusPage } from "@openstatus/icons";

import { NavBreadcrumb } from "@/components/nav/nav-breadcrumb";

export function Breadcrumb() {
  return (
    <NavBreadcrumb
      items={[
        {
          type: "link",
          label: "Status Pages",
          href: "/status-pages",
          icon: StatusPage,
        },
        { type: "page", label: "Create Status Page" },
      ]}
    />
  );
}
