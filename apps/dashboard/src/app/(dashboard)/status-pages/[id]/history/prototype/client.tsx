"use client";

import { Button } from "@openstatus/ui/components/ui/button";
import NextLink from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";

import { Link } from "@/components/common/link";
import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";
import {
  FormCard,
  FormCardContent,
  FormCardDescription,
  FormCardFooter,
  FormCardFooterInfo,
  FormCardHeader,
  FormCardSeparator,
  FormCardTitle,
} from "@/components/forms/form-card";
import {
  UptimeCalculation,
  UptimeModeTiles,
} from "@/components/status-pages/uptime-calculation";
import {
  UPTIME_DOCS_URL,
  UPTIME_MODES,
} from "@/data/uptime-calculation.client";

import { buildPrototypeHistory } from "./data";
import { HistoryOverview } from "./overview";

export function Client() {
  const { id } = useParams<{ id: string }>();
  const history = useMemo(() => buildPrototypeHistory(), []);
  const mode =
    UPTIME_MODES.find((m) => m.value === history.mode) ?? UPTIME_MODES[0];
  const configurationHref = `/status-pages/${id}/components#components-configuration`;

  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>History</SectionTitle>
          <SectionDescription>
            Prototype with example data. Downtime per month, built from your
            page&apos;s components. Months in {history.timeZone}.
          </SectionDescription>
        </SectionHeader>
        <div data-slot="history-prototype">
          <HistoryOverview history={history} />
        </div>
      </Section>
      <Section id="uptime-calculation">
        <FormCard id="how-uptime-is-calculated">
          <FormCardHeader>
            <FormCardTitle>How uptime is calculated</FormCardTitle>
            <FormCardDescription>
              This page counts{" "}
              <span className="text-foreground font-medium">{mode.label}</span>.
              It applies to every month here and to your public status page.{" "}
              <Link href={UPTIME_DOCS_URL}>Learn more</Link>
            </FormCardDescription>
          </FormCardHeader>
          <FormCardSeparator />
          <FormCardContent>
            <UptimeModeTiles mode={mode.value} />
          </FormCardContent>
          <FormCardSeparator />
          <FormCardContent>
            <UptimeCalculation mode={mode.value} />
          </FormCardContent>
          <FormCardFooter className="flex-wrap">
            <FormCardFooterInfo>
              Change it in{" "}
              <Link href={configurationHref}>
                Components &gt; Components Configuration
              </Link>
              .
            </FormCardFooterInfo>
            <Button size="sm" asChild>
              <NextLink href={configurationHref}>Change calculation</NextLink>
            </Button>
          </FormCardFooter>
        </FormCard>
      </Section>
    </SectionGroup>
  );
}
