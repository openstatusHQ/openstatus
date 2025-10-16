"use client";

import { NavBreadcrumb } from "@/components/nav/nav-breadcrumb";
import { Globe } from "lucide-react";

export function Breadcrumb() {
  return (
    <NavBreadcrumb
      items={[{ type: "page", label: "Private Locations", icon: Globe }]}
    />
  );
}
