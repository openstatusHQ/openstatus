"use client";

import type { RouterOutputs } from "@openstatus/api";
import {
  statusColors,
  systemStatusLabels,
} from "@openstatus/ui/components/blocks/status.utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@openstatus/ui/components/ui/collapsible";
import { cn } from "@openstatus/ui/lib/utils";
import { ChevronDown, ExternalLink } from "lucide-react";

import { Link } from "@/components/common/link";
import { StatusBar } from "@/components/status-page/status-bar";
import { StatusComponentGroup } from "@/components/status-page/status-component-group";

type Section = RouterOutputs["statusPage"]["getExternalSection"];
type Provider = Section["providers"][number];
type SectionComponent = Provider["components"][number];
type SectionIncident = Section["incidents"][number];

function safeHttpUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return /^https?:\/\//i.test(url) ? url : null;
}

export function ThirdPartySection({ section }: { section: Section }) {
  if (section.providers.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-muted-foreground font-mono text-sm">
        Third-party dependencies
      </h2>
      {section.providers.map((provider) =>
        provider.components.length === 1 &&
        provider.components[0].isWholeService ? (
          <ExternalCard
            key={provider.externalServiceId}
            component={provider.components[0]}
            statusPageUrl={provider.statusPageUrl}
          />
        ) : (
          <StatusComponentGroup
            key={provider.externalServiceId}
            title={provider.name}
            status={provider.status === "empty" ? undefined : provider.status}
            defaultOpen
          >
            {provider.components.map((component) => (
              <ExternalCard
                key={component.pageComponentId}
                component={component}
                statusPageUrl={provider.statusPageUrl}
              />
            ))}
          </StatusComponentGroup>
        ),
      )}
      <ExternalIncidents incidents={section.incidents} />
    </div>
  );
}

function ExternalCard({
  component,
  statusPageUrl,
}: {
  component: SectionComponent;
  statusPageUrl: string;
}) {
  const status = component.stale ? "empty" : component.status;
  const href = safeHttpUrl(statusPageUrl);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col">
          {href ? (
            <Link
              href={href}
              target="_blank"
              rel="noreferrer"
              variant="unstyled"
              className="inline-flex items-center gap-1 font-mono text-sm font-medium hover:underline"
            >
              {component.name}
              <ExternalLink className="text-muted-foreground size-3" />
            </Link>
          ) : (
            <span className="font-mono text-sm font-medium">
              {component.name}
            </span>
          )}
          {component.description ? (
            <span className="text-muted-foreground text-xs">
              {component.description}
            </span>
          ) : null}
        </div>
        <span className="text-muted-foreground flex shrink-0 items-center gap-2 text-sm">
          <span
            className="size-2 rounded-full"
            style={{ backgroundColor: statusColors[status] }}
          />
          {systemStatusLabels[status].short}
        </span>
      </div>
      <StatusBar data={component.data} />
    </div>
  );
}

function ExternalIncidents({ incidents }: { incidents: SectionIncident[] }) {
  if (incidents.length === 0) return null;

  return (
    <Collapsible className="rounded-lg border">
      <CollapsibleTrigger className="group/incidents flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm">
        Third-party incidents ({incidents.length})
        <ChevronDown className="size-4 transition-transform group-data-[state=open]/incidents:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t">
        <ul className="flex flex-col">
          {incidents.map((incident) => {
            const detailsHref = safeHttpUrl(incident.shortlink);
            return (
              <li
                key={`${incident.serviceSlug}-${incident.id}`}
                className="flex flex-col gap-0.5 border-b px-3 py-2 last:border-b-0"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm">{incident.name}</span>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {incident.serviceName}
                  </span>
                </div>
                <div className="text-muted-foreground flex items-center gap-2 text-xs">
                  <span className={cn(incident.resolvedAt && "text-success")}>
                    {incident.resolvedAt ? "Resolved" : incident.status}
                  </span>
                  <span>·</span>
                  <span>
                    {new Date(
                      incident.startedAt ?? incident.createdAt,
                    ).toLocaleDateString()}
                  </span>
                  {detailsHref ? (
                    <Link href={detailsHref} target="_blank" rel="noreferrer">
                      Details
                    </Link>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}
