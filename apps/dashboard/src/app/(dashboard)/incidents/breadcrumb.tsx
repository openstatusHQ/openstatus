"use client";

import { Incident } from "@openstatus/icons";

import { NavBreadcrumb } from "@/components/nav/nav-breadcrumb";

export function Breadcrumb() {
  return (
    <NavBreadcrumb
      items={[{ type: "page", label: "Incidents", icon: Incident }]}
    />
  );
}
