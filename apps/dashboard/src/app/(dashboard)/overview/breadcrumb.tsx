'use client'

import { NavBreadcrumb } from "@/components/nav/nav-breadcrumb";
import { LayoutGrid } from "lucide-react";

export function Breadcrumb() {
 return <NavBreadcrumb items={[{ type: "page", label: "Overview", icon:LayoutGrid }]} />
}
