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
    <section aria-labelledby="how-it-works-heading">
      {/* Section header */}
      <div className="mb-6">
        <h2
          id="how-it-works-heading"
          className="font-mono text-2xl font-medium tracking-tight text-foreground text-balance"
        >
          How it works
        </h2>
        <p className="mt-1.5 font-mono text-sm text-muted-foreground">
          Up and running in under five minutes.
        </p>
      </div>

      {/* Steps grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isLast = index === steps.length - 1;
          return (
            <div key={step.number} className="relative flex items-stretch">
              {/* Card */}
              <div className="flex flex-1 flex-col gap-4 border border-border p-5">
                {/* Number badge */}
                <span className="font-mono text-xs font-semibold text-success select-none">
                  {step.number}
                </span>

                {/* Icon */}
                <div className="flex h-8 w-8 items-center justify-center border border-success/30 bg-success/5">
                  <Icon
                    className="h-4 w-4 text-success"
                    aria-hidden="true"
                  />
                </div>

                {/* Content */}
                <div className="flex flex-col gap-1">
                  <h3 className="font-mono text-sm font-medium text-foreground">
                    {step.title}
                  </h3>
                  <p className="font-mono text-sm leading-relaxed text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </div>

              {/* Connecting arrow between cards — desktop only */}
              {!isLast && (
                <span
                  aria-hidden="true"
                  className="absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 font-mono text-xs text-muted-foreground/40 md:block"
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
