import { Bell, Globe, Monitor } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: Monitor,
    title: "Add your monitors",
    description:
      "Connect your websites and APIs in seconds. Set your check frequency and regions.",
  },
  {
    number: "02",
    icon: Bell,
    title: "Get notified instantly",
    description:
      "Receive alerts via email, Slack, or SMS the moment downtime is detected.",
  },
  {
    number: "03",
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
      className="border border-border bg-muted/30"
    >
      {/* Section header */}
      <div className="border-b border-border px-6 py-8 text-center">
        <h2
          id="how-it-works-heading"
          className="font-mono text-2xl font-medium tracking-tight text-foreground text-balance"
        >
          How it works
        </h2>
        <p className="mt-2 font-mono text-sm text-muted-foreground">
          Up and running in under five minutes.
        </p>
      </div>

      {/* Steps grid */}
      <div className="grid grid-cols-1 divide-y divide-border md:grid-cols-3 md:divide-x md:divide-y-0">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <div
              key={step.number}
              className="relative flex flex-col gap-4 px-6 py-8"
            >
              {/* Step number badge */}
              <span className="font-mono text-xs font-medium text-muted-foreground select-none">
                {step.number}
              </span>

              {/* Icon */}
              <div className="flex h-9 w-9 items-center justify-center border border-border bg-background">
                <Icon className="h-4 w-4 text-foreground" aria-hidden="true" />
              </div>

              {/* Content */}
              <div className="flex flex-col gap-1.5">
                <h3 className="font-mono text-sm font-medium text-foreground">
                  {step.title}
                </h3>
                <p className="font-mono text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </div>

              {/* Connecting arrow — visible only between cards on desktop */}
              {step.number !== "03" && (
                <span
                  aria-hidden="true"
                  className="absolute -right-3 top-1/2 hidden -translate-y-1/2 font-mono text-xs text-muted-foreground/40 md:block"
                >
                  &rarr;
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
