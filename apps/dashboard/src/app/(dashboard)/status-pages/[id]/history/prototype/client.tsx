"use client";

import { Tabs, TabsList, TabsTrigger } from "@openstatus/ui/components/ui/tabs";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useMemo } from "react";

import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";

import { buildPrototypeHistory } from "./data";
import {
  VariantCalendar,
  VariantCombined,
  VariantHeatmap,
  VariantLedger,
  VariantStrip,
  VariantYear,
} from "./variants";

const VARIANTS = [
  {
    value: "combined",
    label: "A+B · Strip + Calendar",
    description:
      "The year strip picks a month; the status page calendar block shows its days, with components and events beside it.",
    Component: VariantCombined,
  },
  {
    value: "strip",
    label: "A · Strip",
    description:
      "One combined row for the page. Pick a month to see components and events.",
    Component: VariantStrip,
  },
  {
    value: "calendar",
    label: "B · Calendar",
    description:
      "The status-page calendar block with every component's events merged, month summary beside it.",
    Component: VariantCalendar,
  },
  {
    value: "year",
    label: "C · Year",
    description:
      "Twelve mini calendars. Each day is tinted by the worst event across components.",
    Component: VariantYear,
  },
  {
    value: "heatmap",
    label: "D · Heatmap",
    description:
      "Today's table as color, with a combined row on top. Numbers on hover.",
    Component: VariantHeatmap,
  },
  {
    value: "ledger",
    label: "E · Ledger",
    description:
      "Months as a report, newest first: page uptime, component spread and what happened.",
    Component: VariantLedger,
  },
] as const;

const VALUES = VARIANTS.map((v) => v.value);

export function Client() {
  const [variant, setVariant] = useQueryState(
    "variant",
    parseAsStringLiteral(VALUES).withDefault("combined"),
  );
  const history = useMemo(() => buildPrototypeHistory(), []);
  const current = VARIANTS.find((v) => v.value === variant) ?? VARIANTS[0];
  const { Component } = current;

  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>History prototypes</SectionTitle>
          <SectionDescription>{current.description}</SectionDescription>
        </SectionHeader>
        <Tabs
          value={variant}
          onValueChange={(v) => setVariant(v as typeof variant)}
        >
          <TabsList className="flex-wrap">
            {VARIANTS.map((v) => (
              <TabsTrigger key={v.value} value={v.value}>
                {v.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div data-slot="history-prototype">
          <Component history={history} />
        </div>
      </Section>
    </SectionGroup>
  );
}
