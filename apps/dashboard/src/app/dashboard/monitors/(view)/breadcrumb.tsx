"use client";

import { NavBreadcrumb } from "@/components/nav/nav-breadcrumb";
import { Pencil, Siren } from "lucide-react";
import { Logs } from "lucide-react";
import { LayoutGrid } from "lucide-react";

// TODO: make it dynamic

export function Breadcrumb() {
  return (
    <NavBreadcrumb
      items={[
        { type: "link", label: "Monitors", href: "/dashboard/monitors" },
        { type: "page", label: "OpenStatus API" },
        {
          type: "select",
          items: [
            { value: "overview", label: "Overview", icon: LayoutGrid },
            { value: "logs", label: "Logs", icon: Logs },
            { value: "edit", label: "Edit", icon: Pencil },
            { value: "incidents", label: "Incidents", icon: Siren },
          ],
        },
      ]}
    />
  );
}
