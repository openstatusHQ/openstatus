import { Bell, Globe, Monitor } from "lucide-react";

const steps = [
  {
    number: 1,
    title: "Add your monitors",
    description:
      "Connect your websites and APIs in seconds. Set your check frequency and regions.",
    icon: Monitor,
  },
  {
    number: 2,
    title: "Get notified instantly",
    description:
      "Receive alerts via email, Slack, or SMS the moment downtime is detected.",
    icon: Bell,
  },
  {
    number: 3,
    title: "Share your status",
    description:
      "Publish a beautiful public status page to keep your users informed.",
    icon: Globe,
  },
] as const;

export function HowItWorks() {
  return (
    <section className="not-prose my-8 border border-border bg-muted/50 py-12 md:py-16">
      {/* Heading */}
      <div className="mb-10 text-center px-4">
        <h2 className="font-cal text-2xl tracking-tight text-foreground md:text-3xl">
          How it works
        </h2>
        <p className="mt-2 text-sm text-muted-foreground md:text-base">
          Three steps to reliable uptime monitoring and transparent status
          pages.
        </p>
      </div>

      {/* Steps */}
      <div className="relative grid grid-cols-1 gap-8 px-4 md:grid-cols-3 md:gap-0 md:px-8">
        {/* Connecting dotted line (desktop only) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-12 left-[calc(33.333%+0.5rem)] right-[calc(33.333%+0.5rem)] hidden border-t-2 border-dashed border-border md:block"
        />

        {steps.map((step) => (
          <div
            key={step.number}
            className="relative flex flex-col items-center text-center md:px-4"
          >
            {/* Numbered badge */}
            <span className="mb-3 flex h-6 w-6 items-center justify-center border border-border bg-foreground text-[11px] font-semibold text-background">
              {step.number}
            </span>

            {/* Icon container */}
            <div className="relative z-10 mb-4 flex h-16 w-16 items-center justify-center border border-border bg-background">
              <step.icon
                className="h-7 w-7 text-foreground"
                strokeWidth={1.5}
              />
            </div>

            {/* Content */}
            <h3 className="font-cal text-base tracking-tight text-foreground">
              {step.title}
            </h3>
            <p className="mt-1.5 max-w-[26ch] text-sm leading-relaxed text-muted-foreground">
              {step.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
