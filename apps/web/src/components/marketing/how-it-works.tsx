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
      className="-mx-4 w-[calc(100%+2rem)] border-y border-border bg-muted/40"
    >
      <div className="mx-auto max-w-5xl px-4 py-12">
        {/* Section heading */}
        <div className="mb-10 text-center">
          <h2
            id="how-it-works-heading"
            className="font-mono text-2xl font-medium tracking-tight text-foreground"
          >
            How it works
          </h2>
          <p className="mt-2 font-mono text-sm text-muted-foreground">
            Up and running in three simple steps.
          </p>
        </div>

        {/* Steps grid */}
        <div className="relative grid grid-cols-1 gap-px border border-border bg-border sm:grid-cols-3">
          {steps.map((step) => (
            <StepCard key={step.number} step={step} />
          ))}

          {/* Dotted connector lines — visible only on sm+ between cards */}
          <ConnectorLines />
        </div>
      </div>
    </section>
  );
}

function StepCard({ step }: { step: Step }) {
  const Icon = step.icon;
  return (
    <div className="relative flex flex-col gap-4 bg-background p-6 hover:bg-muted/60 transition-colors duration-150">
      {/* Numbered badge */}
      <div className="flex items-center justify-between">
        <span
          aria-hidden="true"
          className="inline-flex h-6 w-6 items-center justify-center border border-border bg-muted font-mono text-xs font-semibold text-muted-foreground tabular-nums"
        >
          {step.number}
        </span>
        <Icon
          className="h-5 w-5 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
      </div>

      {/* Text content */}
      <div className="flex flex-col gap-1">
        <h3 className="font-mono text-sm font-semibold text-foreground">
          {step.title}
        </h3>
        <p className="font-mono text-xs leading-relaxed text-muted-foreground">
          {step.description}
        </p>
      </div>
    </div>
  );
}

/**
 * Renders two dotted arrow connectors between the three step cards.
 * Only visible at sm breakpoint and above where the cards sit side by side.
 */
function ConnectorLines() {
  return (
    <>
      {/* Connector between step 1 and 2 */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 hidden sm:block"
        style={{ left: "calc(33.333% - 1px)" }}
      >
        <DottedArrow />
      </div>
      {/* Connector between step 2 and 3 */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 hidden sm:block"
        style={{ left: "calc(66.666% - 1px)" }}
      >
        <DottedArrow />
      </div>
    </>
  );
}

function DottedArrow() {
  return (
    <div className="flex h-full w-8 -translate-x-1/2 items-center justify-center">
      <svg
        width="32"
        height="16"
        viewBox="0 0 32 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="text-border"
        aria-hidden="true"
      >
        <line
          x1="0"
          y1="8"
          x2="24"
          y2="8"
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="3 3"
        />
        <polyline
          points="20,4 28,8 20,12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
