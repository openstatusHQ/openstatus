"use client";

import { NavBreadcrumb } from "@/components/nav/nav-breadcrumb";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Pencil, Siren } from "lucide-react";
import { Logs } from "lucide-react";
import { LayoutGrid } from "lucide-react";
import { useParams } from "next/navigation";

export function Breadcrumb() {
  const { id } = useParams<{ id: string }>();
  const trpc = useTRPC();
  const { data: monitor } = useQuery(
    trpc.monitor.get.queryOptions({ id: parseInt(id) })
  );

  if (!monitor) return null;

  return (
    <NavBreadcrumb
      items={[
        { type: "link", label: "Monitors", href: "/monitors" },
        { type: "page", label: monitor.name },
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
