"use client";

import { StatusPage } from "@openstatus/icons";

import { NavBreadcrumb } from "@/components/nav/nav-breadcrumb";

export function Breadcrumb() {
  return (
    <NavBreadcrumb
      items={[{ type: "page", label: "Status Pages", icon: StatusPage }]}
    />
  );
}
