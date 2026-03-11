import { cn } from "@/lib/utils";
import { Bell, Globe, Monitor, ArrowRight } from "lucide-react";

const steps = [
  {
    step: 1,
    title: "Add your monitors",
    description:
      "Connect your websites and APIs in seconds. Set your check frequency and regions.",
    icon: Monitor,
  },
  {
    step: 2,
    title: "Get notified instantly",
    description:
      "Receive alerts via email, Slack, or SMS the moment downtime is detected.",
    icon: Bell,
  },
  {
    step: 3,
    title: "Share your status",
    description:
      "Publish a beautiful public status page to keep your users informed.",
    icon: Globe,
  },
];

export function HowItWorks() {
  return (
    <section className="not-prose my-8">
      {/* Header */}
      <div className="mb-8 text-center">
        <h2 className="mb-2 font-cal text-3xl font-medium tracking-tight text-foreground md:text-4xl">
          How it works
        </h2>
        <p className="text-muted-foreground">
          Get up and running in three simple steps
        </p>
      </div>

      {/* Steps */}
      <div className="relative grid grid-cols-1 gap-px border border-border bg-border md:grid-cols-3">
        {steps.map((step, index) => (
          <div
            key={step.step}
            className="relative flex flex-col bg-muted/30 p-6 transition-colors hover:bg-muted/50"
          >
            {/* Step number badge */}
            <div className="mb-4 flex items-start justify-between">
              <span className="flex h-8 w-8 items-center justify-center border border-border bg-background font-mono text-sm text-muted-foreground">
                {step.step}
              </span>
              <step.icon className="h-5 w-5 text-muted-foreground" />
            </div>

            {/* Content */}
            <h3 className="mb-2 font-medium text-foreground">{step.title}</h3>
            <p className="text-sm text-muted-foreground">{step.description}</p>

            {/* Connecting arrow (visible on desktop, between cards) */}
            {index < steps.length - 1 && (
              <div className="absolute right-0 top-1/2 z-10 hidden -translate-y-1/2 translate-x-1/2 md:block">
                <div className="flex items-center gap-1">
                  <span className="h-px w-4 border-t border-dashed border-muted-foreground/50" />
                  <ArrowRight className="h-3 w-3 text-muted-foreground/50" />
                </div>
              </div>
            )}

            {/* Mobile vertical connector */}
            {index < steps.length - 1 && (
              <div className="absolute bottom-0 left-1/2 z-10 -translate-x-1/2 translate-y-1/2 md:hidden">
                <div className="flex flex-col items-center gap-1">
                  <span className="h-4 w-px border-l border-dashed border-muted-foreground/50" />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
