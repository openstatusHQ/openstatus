'use client'

import { NavBreadcrumb } from "@/components/nav/nav-breadcrumb";
import { Terminal } from "lucide-react";

export function Breadcrumb() {
 return <NavBreadcrumb items={[{ type: "page", label: "CLI", icon:Terminal }]} />
}
