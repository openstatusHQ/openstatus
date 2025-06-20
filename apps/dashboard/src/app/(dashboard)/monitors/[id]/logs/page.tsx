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
import DatePicker from "@/components/date-picker";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { responseLogs } from "@/data/response-logs";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Lock, X } from "lucide-react";
import { useParams } from "next/navigation";

const logs = Array.from({ length: 10 }).flatMap(() => responseLogs);

export default function Page() {
  const trpc = useTRPC();
  const { id } = useParams<{ id: string }>();
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const { data: monitor } = useQuery(
    trpc.monitor.get.queryOptions({ id: Number.parseInt(id) })
  );

  if (!workspace || !monitor) return null;

  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>{monitor.name}</SectionTitle>
          <SectionDescription>{monitor.url}</SectionDescription>
        </SectionHeader>
        <div className="flex flex-wrap gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                Last 7 days
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <DatePicker />
            </PopoverContent>
          </Popover>
          <Button variant="ghost" size="sm">
            <X />
            Reset
          </Button>
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
