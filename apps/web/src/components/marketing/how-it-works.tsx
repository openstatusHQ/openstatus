import { Bell, Globe, Monitor } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Step {
  number: number;
  icon: LucideIcon;
  title: string;
  description: string;
}

const steps: Step[] = [
  {
    number: 1,
    icon: Monitor,
    title: "Add your monitors",
    description:
      "Connect your websites and APIs in seconds. Set your check frequency and regions.",
  },
  {
    number: 2,
    icon: Bell,
    title: "Get notified instantly",
    description:
      "Receive alerts via email, Slack, or SMS the moment downtime is detected.",
  },
  {
    number: 3,
    icon: Globe,
    title: "Share your status",
    description:
      "Publish a beautiful public status page to keep your users informed.",
  },
];

export function HowItWorks() {
  return (
    <section
      aria-labelledby="how-it-works-heading"
      className="not-prose -mx-4 bg-muted/40 border-y border-border px-4 py-12 sm:py-16"
    >
      <div className="mx-auto max-w-5xl">
        {/* Heading */}
        <div className="mb-10 text-center sm:mb-12">
          <h2
            id="how-it-works-heading"
            className="font-cal text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
          >
            How it works
          </h2>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            Up and running in minutes. No credit card required.
          </p>
        </div>

        {/* Steps */}
        <div className="relative grid grid-cols-1 gap-6 sm:grid-cols-3">
          {/* Connecting dotted line — desktop only */}
          <div
            aria-hidden="true"
            className="absolute top-8 left-[calc(16.67%+1.5rem)] right-[calc(16.67%+1.5rem)] hidden h-px border-t border-dashed border-border sm:block"
          />

          {steps.map((step) => (
            <StepCard key={step.number} step={step} />
          ))}
        </div>
      </div>
    </section>
  );
}

function StepCard({ step }: { step: Step }) {
  const Icon = step.icon;

  return (
    <div className="relative flex flex-col items-center gap-4 border border-border bg-background p-6 text-center">
      {/* Numbered badge */}
      <span className="absolute -top-3 left-1/2 -translate-x-1/2 border border-border bg-background px-2 py-0.5 font-mono text-xs text-muted-foreground">
        {step.number.toString().padStart(2, "0")}
      </span>

      {/* Icon */}
      <div className="mt-2 flex h-10 w-10 items-center justify-center border border-border bg-muted/50 text-foreground">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>

      {/* Text */}
      <div className="flex flex-col gap-1.5">
        <h3 className="font-medium text-foreground">{step.title}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {step.description}
        </p>
      </div>
    </div>
  );
}
