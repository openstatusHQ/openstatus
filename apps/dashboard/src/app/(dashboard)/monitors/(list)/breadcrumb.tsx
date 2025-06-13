import { NavBreadcrumb } from "@/components/nav/nav-breadcrumb";

export function Breadcrumb() {
  return <NavBreadcrumb items={[{ type: "page", label: "Monitors" }]} />;
}
