"use client";

import { Settings, AuditLog } from "@openstatus/icons";

import { NavBreadcrumb } from "@/components/nav/nav-breadcrumb";

export function Breadcrumb() {
  return (
    <NavBreadcrumb
      items={[
        {
          type: "link",
          label: "Settings",
          icon: Settings,
          href: "/settings/general",
        },
        { type: "page", label: "Audit Logs", icon: AuditLog },
      ]}
    />
  );
}
