"use client";

import { useParams, useSelectedLayoutSegment } from "next/navigation";

import { TabsContainer, TabsLink } from "@/components/dashboard/tabs-link";
import { StatusDot } from "@/components/monitor/status-dot";
import { pagesConfig } from "@/config/pages";
import { api } from "@/trpc/client";
import { useEffect, useState } from "react";

export function AppTabs() {
  const params = useParams();
  const selectedSegment = useSelectedLayoutSegment();

  if (!params?.workspaceSlug) return null;

  return (
    <div className="-mb-3">
      <TabsContainer>
        {pagesConfig.map(({ title, segment, href }) => {
          const active = segment === selectedSegment;
          return (
            <TabsLink
              key={segment}
              active={active}
              href={`/app/${params?.workspaceSlug}${href}`}
              prefetch={false}
              className="relative"
            >
              {title}
              {/* {segment === "incidents" ? <IncidentsDot /> : null} */}
            </TabsLink>
          );
        })}
      </TabsContainer>
    </div>
  );
}

// FIXME: use react-query - once the user resolves the incident, the dot should disappear without refresh
function IncidentsDot() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    async function checkOpenIncidents() {
      const incidents = await api.incident.getOpenIncidents.query();
      if (incidents.length) setOpen(true);
    }

    checkOpenIncidents();
  }, []);

  if (!open) return null;

  return (
    <div className="absolute top-1 right-1">
      <StatusDot status="error" active />
    </div>
  );
}
