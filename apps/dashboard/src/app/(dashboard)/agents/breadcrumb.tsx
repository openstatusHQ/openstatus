"use client";

import { NavBreadcrumb } from "@/components/nav/nav-breadcrumb";
import { Bot } from "lucide-react";

export function Breadcrumb() {
  return (
    <NavBreadcrumb items={[{ type: "page", label: "Agents", icon: Bot }]} />
  );
}
