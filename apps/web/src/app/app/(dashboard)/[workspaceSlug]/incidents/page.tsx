import * as React from "react";
import Link from "next/link";
import { formatDistance } from "date-fns";

import { Container } from "@/components/dashboard/container";
import { Header } from "@/components/dashboard/header";
import { Icons } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { statusDict } from "@/data/incidents-dictionary";
import { api } from "@/trpc/server";
import { ActionButton } from "./_components/action-button";
import { Events } from "./_components/events";

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
      <div className="col-span-full grid sm:grid-cols-6">
        <ul role="list" className="grid gap-4 sm:col-span-6">
          {incidents.map((incident, i) => {
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
                      <Badge variant="outline" className="ml-2">
                        <Icon className="mr-1 h-3 w-3" />
                        {label}
                      </Badge>
                    </>
                  }
                  actions={[
                    <Button key="status-button" variant="outline" size="sm">
                      <Link
                        href={`./incidents/update/edit?incidentId=${incident.id}`}
                      >
                        New Status
                      </Link>
                    </Button>,
                    <ActionButton
                      key="action-button"
                      id={incident.id}
                      workspaceSlug={params.workspaceSlug}
                    />,
                  ]}
                >
                  <div className="grid gap-3">
                    <div className="flex space-x-3">
                      <Icons.activity className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
                      <div className="grid gap-2">
                        {incident.monitorsToIncidents.length > 0 ? (
                          incident.monitorsToIncidents.map(
                            ({ monitor: { name, description } }, i) => (
                              <div key={i} className="text-sm">
                                <p>{name}</p>
                                <p className="text-muted-foreground">
                                  {description}
                                </p>
                              </div>
                            ),
                          )
                        ) : (
                          <p className="text-muted-foreground text-sm">
                            Monitor(s) missing
                          </p>
                        )}
                      </div>
                    </div>
                    {/* Make it ordered by desc and make it toggable if you want the whole history! */}
                    <Events incidentUpdates={incident.incidentUpdates} />
                  </div>
                </Container>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
