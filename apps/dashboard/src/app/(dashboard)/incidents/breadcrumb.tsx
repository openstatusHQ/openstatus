"use client";

import { Incident } from "@openstatus/icons";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";

import { NavBreadcrumb } from "@/components/nav/nav-breadcrumb";
import { useTRPC } from "@/lib/trpc/client";

export function Breadcrumb() {
  const trpc = useTRPC();
  const params = useParams<{ id?: string }>();
  const id = params.id ? Number(params.id) : null;
  const { data: incident } = useQuery({
    ...trpc.incident.get.queryOptions({ id: id ?? 0 }),
    enabled: id !== null,
    retry: false,
  });

  if (id === null) {
    return (
      <NavBreadcrumb
        items={[{ type: "page", label: "Incidents", icon: Incident }]}
      />
    );
  }
  return (
    <NavBreadcrumb
      items={[
        {
          type: "link",
          label: "Incidents",
          icon: Incident,
          href: "/incidents",
        },
        { type: "page", label: incident?.title ?? `Incident #${id}` },
      ]}
    />
  );
}
