import {
  defaultMetadata,
  ogMetadata,
  twitterMetadata,
} from "@/app/shared-metadata";
import { Shell } from "@/components/dashboard/shell";
import {
  CardContainer,
  CardDescription,
  CardHeader,
  CardIcon,
  CardTitle,
} from "@/components/marketing/card";
import { BottomCTA } from "@/components/marketing/in-between-cta";
import type { Metadata } from "next";
import { UptimeSLAForm } from "./_components/uptime-sla-form";

const title = "Uptime SLA Calculator";
const description =
  "Calculate uptime SLA percentages, allowed downtime, and service availability metrics. Free tool for monitoring uptime across days, weeks, months, and years. Perfect for SLA planning and compliance.";

export const metadata: Metadata = {
  ...defaultMetadata,
  title,
  description,
  twitter: {
    ...twitterMetadata,
    title,
    description,
    images: [`/api/og?title=${title}&description=${description}`],
  },
  openGraph: {
    ...ogMetadata,
    title,
    description,
    images: [`/api/og?title=${title}&description=${description}`],
  },
};

export default function CurlBuilder() {
  return (
    <div className="grid h-full w-full gap-12">
      <CardContainer>
        <CardHeader>
          <CardIcon icon="shield-check" />
          <CardTitle>Uptime SLA Calculator</CardTitle>
          <CardDescription className="max-w-md">
            Calculate allowed downtime from uptime percentages or determine
            uptime percentages from actual downtime. Supports multiple reporting
            periods and SLA tiers.
          </CardDescription>
        </CardHeader>
        <div className="mx-auto grid w-full max-w-xl gap-8">
          <UptimeSLAForm
            defaultValues={{
              uptime: 99.99,
              downtime: "1m",
            }}
          />
          <p className="text-center text-muted-foreground text-sm">
            All calculations assume continuous 24/7 availability requirements.
          </p>
        </div>
      </CardContainer>
      <Informations />
      <BottomCTA />
    </div>
  );
}

//
function Informations() {
  return (
    <Shell>
      <div className="grid gap-1">
        <h3 className="font-semibold">Understanding Uptime SLA</h3>
        <p className="text-muted-foreground">
          Service Level Agreements (SLAs) define the expected performance and
          availability of your services. Understanding uptime percentages and
          their corresponding downtime allowances is crucial for maintaining
          customer trust and meeting compliance requirements.
        </p>
        <p className="text-muted-foreground">
          Common SLA tiers include 99.9% (three nines), 99.99% (four nines), and
          99.999% (five nines), each representing different levels of
          reliability. For example, 99.9% uptime allows for 8.77 hours of
          downtime per year, while 99.99% allows only 52.6 minutes annually.
        </p>
        <p className="text-muted-foreground">
          This calculator helps you understand the real-world impact of your SLA
          commitments and plan for capacity, incident response, and stakeholder
          expectations.
        </p>
      </div>
    </Shell>
  );
}
