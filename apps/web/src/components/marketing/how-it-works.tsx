import { cn } from "@/lib/utils";
import { Bell, Globe, Monitor } from "lucide-react";

const steps = [
  {
    number: 1,
    title: "Add your monitors",
    description:
      "Add websites and APIs. Choose interval and regions. Add assertions (status, headers, body).",
    icon: Monitor,
  },
  {
    number: 2,
    title: "Get notified instantly",
    description:
      "Alert on failures and latency. Notify via email + integrations like Slack, Discord, and PagerDuty.",
    icon: Bell,
  },
  {
    number: 3,
    title: "Share your status",
    description:
      "Publish a clean status page that reflects incidents automatically. Customize theme and branding.",
    icon: Globe,
  },
] as const;

function StepCard({
  step,
}: {
  step: (typeof steps)[number];
}) {
  const Icon = step.icon;
  return (
    <div className="relative flex flex-col gap-4 border border-border bg-background p-6">
      <span
        className="flex h-6 w-6 items-center justify-center border border-border font-mono text-xs text-muted-foreground"
        aria-hidden="true"
      >
        {step.number}
      </span>
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5 shrink-0 text-foreground" aria-hidden="true" />
        <h3 className="font-mono text-sm font-medium text-foreground">
          {step.title}
        </h3>
      </div>
      <p className="font-mono text-sm leading-relaxed text-muted-foreground">
        {step.description}
      </p>
    </div>
  );
}

function DottedConnector() {
  return (
    <div
      className="hidden items-center justify-center md:flex"
      aria-hidden="true"
    >
      <div className="h-px w-full border-t border-dashed border-border" />
    </div>
  );
}

export function HowItWorks() {
  return (
    <section className="not-prose my-8 border border-border bg-muted/30 p-6 md:p-8">
      <div className="mb-8 text-center">
        <h2 className="font-mono text-lg font-medium text-foreground">
          How it works
        </h2>
        <p className="mx-auto mt-2 max-w-xl font-mono text-sm text-muted-foreground">
          From endpoint checks to alerts and a public status page — in a few
          minutes.
        </p>
      </div>
      <div
        className={cn(
          "grid grid-cols-1 gap-4",
          "md:grid-cols-[1fr_auto_1fr_auto_1fr] md:gap-0",
        )}
      >
        <StepCard step={steps[0]} />
        <DottedConnector />
        <StepCard step={steps[1]} />
        <DottedConnector />
        <StepCard step={steps[2]} />
      </div>
    </section>
  );
}
