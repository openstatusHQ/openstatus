"use client";

import { Settings } from "@openstatus/icons";
import { useQuery } from "@tanstack/react-query";
import { useParams, usePathname } from "next/navigation";

import { NavBreadcrumb } from "@/components/nav/nav-breadcrumb";
import { NAV } from "@/config/nav";
import { useTRPC } from "@/lib/trpc/client";

export function Breadcrumb() {
  const pathname = usePathname();
  const { id } = useParams<{ id?: string }>();
  const trpc = useTRPC();
  const root = NAV.reports;
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const onPolicy = workspace?.limits["monitor-sla"] === true && !!id;
  const { data: policies } = useQuery({
    ...trpc.uptimeTarget.list.queryOptions(),
    enabled: onPolicy,
  });
  const active = id ? policies?.find((p) => String(p.id) === id) : undefined;
  const { data: archived } = useQuery({
    ...trpc.uptimeTarget.list.queryOptions({ archived: true }),
    enabled: onPolicy && !!policies && !active,
  });
  const policy = active ?? archived?.find((p) => String(p.id) === id);
  const editing = pathname.endsWith("/edit");

  if (!policy) {
    return (
      <NavBreadcrumb
        items={[{ type: "page", label: root.label, icon: root.icon }]}
      />
    );
  }
  return (
    <NavBreadcrumb
      items={[
        { type: "link", label: root.label, icon: root.icon, href: root.href },
        ...(editing
          ? [
              {
                type: "link" as const,
                label: policy.name,
                href: `${root.href}/${policy.id}/overview`,
              },
              { type: "page" as const, label: "Settings", icon: Settings },
            ]
          : [{ type: "page" as const, label: policy.name }]),
      ]}
    />
  );
}
