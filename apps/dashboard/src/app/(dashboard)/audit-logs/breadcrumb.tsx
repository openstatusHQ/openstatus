"use client";

import { NavBreadcrumb } from "@/components/nav/nav-breadcrumb";
import { ScanEye } from "lucide-react";

export function Breadcrumb() {
  return (
    <NavBreadcrumb
      items={[{ type: "page", label: "Audit Logs", icon: ScanEye }]}
    />
  );
}
