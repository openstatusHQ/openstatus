"use client";

import { Link } from "@/components/common/link";
import {
  BillingOverlay,
  BillingOverlayButton,
  BillingOverlayContainer,
  BillingOverlayDescription,
} from "@/components/content/billing-overlay";
import {
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";

import { Section } from "@/components/content/section";
import { DataTable } from "@/components/data-table/response-logs/data-table";
import { responseLogs } from "@/data/response-logs";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { useParams } from "next/navigation";
import { DropdownPeriod } from "@/components/controls-search/dropdown-period";
import { CommandRegion } from "@/components/controls-search/command-region";
import { DropdownStatus } from "@/components/controls-search/dropdown-status";
import { ButtonReset } from "@/components/controls-search/button-reset";
import { searchParamsParsers } from "./search-params";
import { useQueryStates } from "nuqs";

const logs = Array.from({ length: 10 }).flatMap(() => responseLogs);

export function Client() {
  const trpc = useTRPC();
  const { id } = useParams<{ id: string }>();
  const [{ period, regions, status }] = useQueryStates(searchParamsParsers);
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const { data: monitor } = useQuery(
    trpc.monitor.get.queryOptions({ id: Number.parseInt(id) })
  );
  if (!workspace || !monitor) return null;

  console.log({ period, regions, status });

  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>{monitor.name}</SectionTitle>
          <SectionDescription>{monitor.url}</SectionDescription>
        </SectionHeader>
        <div className="flex flex-wrap gap-2">
          <DropdownPeriod />
          <DropdownStatus />
          <CommandRegion regions={monitor.regions} />
          <ButtonReset />
        </div>
      </Section>
      <Section>
        {workspace.plan === "free" ? (
          <BillingOverlayContainer>
            <DataTable data={logs} />
            <BillingOverlay>
              <BillingOverlayButton asChild>
                <Link href="/settings/billing">
                  <Lock />
                  Upgrade to Pro
                </Link>
              </BillingOverlayButton>
              <BillingOverlayDescription>
                Access response headers, timing phases and more for each
                request. <Link href="#">Learn more</Link>.
              </BillingOverlayDescription>
            </BillingOverlay>
          </BillingOverlayContainer>
        ) : (
          <DataTable data={logs} />
        )}
      </Section>
    </SectionGroup>
  );
}
