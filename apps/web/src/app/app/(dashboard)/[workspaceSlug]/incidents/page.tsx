import * as React from "react";
import Link from "next/link";
import { formatDistance } from "date-fns";

import { Container } from "@/components/dashboard/container";
import { Header } from "@/components/dashboard/header";
import { Icons } from "@/components/icons";
import { AffectedMonitors } from "@/components/incidents/affected-monitors";
import { Events } from "@/components/incidents/events";
import { StatusBadge } from "@/components/incidents/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { statusDict } from "@/data/incidents-dictionary";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/server";
import { ActionButton } from "./_components/action-button";
import { EmptyState } from "./_components/empty-state";

export default async function IncidentPage({
  params,
}: {
  params: { workspaceSlug: string };
}) {
  const incidents = await api.incident.getIncidentByWorkspace.query({
    workspaceSlug: params.workspaceSlug,
  });
  return (
    <div className="grid gap-6 md:grid-cols-1 md:gap-8">
      <Header title="Incidents" description="Overview of all your incidents.">
        <Button asChild>
          <Link href="./incidents/edit">Create</Link>
        </Button>
      </Header>
      {Boolean(incidents?.length) ? (
        <div className="col-span-full grid sm:grid-cols-6">
          <ul role="list" className="grid gap-4 sm:col-span-6">
            {incidents?.map((incident, i) => {
              const { label, icon } =
                statusDict[incident.status as keyof typeof statusDict];
              const Icon = Icons[icon];
              return (
                <li key={i} className="grid gap-2">
                  <time className="text-muted-foreground pl-3 text-xs">
                    {formatDistance(new Date(incident.createdAt!), new Date(), {
                      addSuffix: true,
                    })}
                  </time>
                  <Container
                    title={
                      <>
                        {incident.title}
                        <StatusBadge status={incident.status} />
                      </>
                    }
                    actions={[
                      <Button key="status-button" variant="outline" size="sm">
                        <Link
                          href={`./incidents/update/edit?incidentId=${incident.id}`}
                        >
                          New Update
                        </Link>
                      </Button>,
                      <ActionButton
                        key="action-button"
                        id={incident.id}
                        workspaceSlug={params.workspaceSlug}
                      />,
                    ]}
                  >
                    <div className="grid gap-4">
                      <div>
                        <p className="text-muted-foreground mb-1.5 text-xs">
                          Affected Monitors
                        </p>
                        <AffectedMonitors
                          monitors={incident.monitorsToIncidents.map(
                            ({ monitor }) => monitor,
                          )}
                        />
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1.5 text-xs">
                          Last Updates
                        </p>
                        {/* Make it ordered by desc and make it toggable if you want the whole history! */}
                        <Events
                          incidentUpdates={incident.incidentUpdates}
                          editable
                        />
                      </div>
                    </div>
                  </Container>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}
