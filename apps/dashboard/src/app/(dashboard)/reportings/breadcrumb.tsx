"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams, usePathname } from "next/navigation";

import { NavBreadcrumb } from "@/components/nav/nav-breadcrumb";
import { NAV } from "@/config/nav";
import { useTRPC } from "@/lib/trpc/client";

import { SLA_POLICY_TABS } from "./constants";

export function Breadcrumb() {
  const pathname = usePathname();
  const { id } = useParams<{ id?: string }>();
  const trpc = useTRPC();
  const root = NAV.slaPolicies;
  const tab = SLA_POLICY_TABS.find((t) => pathname.startsWith(t.href));
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const onPolicy =
    workspace?.limits["monitor-sla"] === true &&
    !!id &&
    tab?.value === "monitors";
  const { data: policies } = useQuery({
    ...trpc.monitorSlaPolicy.list.queryOptions(),
    enabled: onPolicy,
  });
  const active = id ? policies?.find((p) => String(p.id) === id) : undefined;
  const { data: archived } = useQuery({
    ...trpc.monitorSlaPolicy.list.queryOptions({ archived: true }),
    enabled: onPolicy && !!policies && !active,
  });
  const policy = active ?? archived?.find((p) => String(p.id) === id);
  const editing = pathname.endsWith("/edit");

  return (
    <NavBreadcrumb
      items={[
        { type: "link", label: root.label, icon: root.icon, href: root.href },
        ...(tab && policy
          ? [
              {
                type: "link" as const,
                label: tab.label,
                icon: tab.icon,
                href: tab.href,
              },
              ...(editing
                ? [
                    {
                      type: "link" as const,
                      label: policy.name,
                      href: `${tab.href}/${policy.id}`,
                    },
                    { type: "page" as const, label: "Settings" },
                  ]
                : [{ type: "page" as const, label: policy.name }]),
            ]
          : tab
            ? [{ type: "page" as const, label: tab.label, icon: tab.icon }]
            : []),
      ]}
    />
  );
}
