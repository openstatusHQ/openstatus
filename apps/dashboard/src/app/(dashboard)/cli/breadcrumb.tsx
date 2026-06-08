"use client";

import { Terminal } from "lucide-react";

import { NavBreadcrumb } from "@/components/nav/nav-breadcrumb";

export function Breadcrumb() {
  return (
    <NavBreadcrumb items={[{ type: "page", label: "CLI", icon: Terminal }]} />
  );
}
