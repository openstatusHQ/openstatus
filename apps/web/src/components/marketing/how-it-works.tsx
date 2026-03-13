import { ArrowRight, Bell, Globe, Monitor } from "lucide-react";
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
            className="font-cal text-2xl font-semibold tracking-tight tracking-wide text-foreground sm:text-3xl"
          >
            How it works
          </h2>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            Up and running in minutes. No credit card required.
          </p>
        </div>

        {/* Steps — cards interleaved with arrows on desktop */}
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-0">
          {steps.map((step, index) => (
            <div key={step.number} className="contents">
              <div className="sm:flex-1">
                <StepCard step={step} />
              </div>
              {index < steps.length - 1 && (
                <div
                  aria-hidden="true"
                  className="hidden sm:flex items-center justify-center self-start mt-8 px-1"
                >
                  <div className="flex items-center gap-0">
                    <div className="w-8 h-0.5 bg-[var(--color-success)]" />
                    <div
                      className="w-0 h-0"
                      style={{
                        borderTop: "6px solid transparent",
                        borderBottom: "6px solid transparent",
                        borderLeft: "10px solid var(--color-success)",
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
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
      <span className="absolute -top-3 left-1/2 -translate-x-1/2 border border-[var(--color-success)] bg-background px-2 py-0.5 font-mono text-xs font-medium text-[var(--color-success)]">
        {step.number.toString().padStart(2, "0")}
      </span>

      {/* Icon */}
      <div className="mt-2 flex h-10 w-10 items-center justify-center border border-[var(--color-success)]/30 bg-[var(--color-success)]/10 text-[var(--color-success)]">
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
