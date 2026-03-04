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
];

export function HowItWorks() {
  return (
    <section className="not-prose -mx-4 my-8 border-y border-border bg-muted/40 px-4 py-12 md:py-16">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-10 text-center md:mb-12">
          <p className="mb-2 text-xs font-medium uppercase tracking-widest text-success">
            Getting started
          </p>
          <h2 className="font-cal text-2xl tracking-tight text-foreground md:text-3xl">
            How it works
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Get up and running in three simple steps
          </p>
        </div>

        {/* Steps */}
        <div className="relative grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-0">
          {/* Connecting lines (desktop only) */}
          <div
            className="pointer-events-none absolute top-[2.25rem] right-[calc(33.333%+1.5rem)] left-[calc(33.333%-1.5rem)] hidden h-px md:block"
            aria-hidden="true"
          >
            <div className="h-full w-full border-t-2 border-dashed border-success/30" />
          </div>
          <div
            className="pointer-events-none absolute top-[2.25rem] right-[calc(0%+3rem)] left-[calc(66.666%-1.5rem)] hidden h-px md:block"
            aria-hidden="true"
          >
            <div className="h-full w-full border-t-2 border-dashed border-success/30" />
          </div>

          {steps.map((step) => (
            <div key={step.number} className="relative mx-2 flex flex-col items-center border border-border bg-background p-6 text-center">
              {/* Number badge + icon */}
              <div className="relative mb-4">
                <div className="flex h-12 w-12 items-center justify-center border border-success/20 bg-success/5">
                  <step.icon className="h-5 w-5 text-green-700 dark:text-green-400" strokeWidth={1.5} />
                </div>
                <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center bg-success text-[10px] font-bold text-background">
                  {step.number}
                </span>
              </div>

              {/* Content */}
              <h3 className="mb-1 text-sm font-semibold text-foreground">
                {step.title}
              </h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
