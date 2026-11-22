"use client";

import { useMemo } from "react";

import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";

import { buildPrototypeHistory } from "./data";
import { HistoryOverview } from "./overview";

export function Client() {
  const history = useMemo(() => buildPrototypeHistory(), []);

  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>History prototype</SectionTitle>
          <SectionDescription>
            Example data. Bars show downtime per month; uptime has no color
            because we don&apos;t know your target.
          </SectionDescription>
        </SectionHeader>
        <div data-slot="history-prototype">
          <HistoryOverview history={history} />
        </div>
      </Section>
    </SectionGroup>
  );
}
