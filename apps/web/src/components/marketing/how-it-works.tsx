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
    <section className="not-prose border-y border-border bg-muted/50 py-16 md:py-20">
      <div className="mx-auto max-w-5xl px-6">
        {/* Heading */}
        <div className="mb-12 text-center">
          <h2 className="font-cal text-3xl tracking-tight text-foreground md:text-4xl">
            How it works
          </h2>
          <p className="mt-3 text-muted-foreground md:text-lg">
            Three steps to reliable uptime monitoring and transparent status
            pages.
          </p>
        </div>

        {/* Steps */}
        <div className="relative grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-0">
          {/* Connecting dotted line (desktop only) */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-14 right-[calc(33.333%+1rem)] left-[calc(33.333%-1rem)] hidden border-t-2 border-dashed border-border md:block"
          />

          {steps.map((step) => (
            <div key={step.number} className="relative flex flex-col items-center text-center md:px-6">
              {/* Numbered badge */}
              <span className="mb-4 flex h-7 w-7 items-center justify-center bg-foreground text-xs font-semibold text-background">
                {step.number}
              </span>

              {/* Icon container */}
              <div className="relative z-10 mb-5 flex h-20 w-20 items-center justify-center border border-border bg-background">
                <step.icon className="h-8 w-8 text-foreground" strokeWidth={1.5} />
              </div>

              {/* Content */}
              <h3 className="font-cal text-lg tracking-tight text-foreground">
                {step.title}
              </h3>
              <p className="mt-2 max-w-[28ch] text-sm leading-relaxed text-muted-foreground">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
