import { Bell, Globe, Monitor, ArrowRight } from "lucide-react";

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
    <section className="bg-muted/50 py-16 md:py-24">
      <div className="mx-auto max-w-5xl px-4">
        {/* Header */}
        <div className="mb-12 text-center md:mb-16">
          <h2 className="mb-3 font-cal text-3xl tracking-tight md:text-4xl">
            How it works
          </h2>
          <p className="mx-auto max-w-xl text-muted-foreground">
            Get started in minutes. Monitor your services, stay informed, and
            keep your users in the loop.
          </p>
        </div>

        {/* Steps */}
        <div className="relative grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-4">
          {/* Connecting line - desktop only */}
          <div
            className="absolute top-[4.5rem] left-[calc(16.67%+2rem)] hidden h-px w-[calc(66.67%-4rem)] border-t-2 border-dashed border-border md:block"
            aria-hidden="true"
          />

          {steps.map((step, index) => (
            <div key={step.number} className="relative flex flex-col">
              {/* Card */}
              <div className="flex h-full flex-col border border-border bg-background p-6">
                {/* Number badge */}
                <div className="mb-4 flex items-start justify-between">
                  <span className="flex h-8 w-8 items-center justify-center border border-border bg-muted font-mono text-sm text-muted-foreground">
                    {step.number}
                  </span>
                  <step.icon className="h-5 w-5 text-muted-foreground" />
                </div>

                {/* Content */}
                <h3 className="mb-2 font-semibold">{step.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {step.description}
                </p>
              </div>

              {/* Arrow indicator - mobile only */}
              {index < steps.length - 1 && (
                <div
                  className="flex justify-center py-2 text-muted-foreground md:hidden"
                  aria-hidden="true"
                >
                  <ArrowRight className="h-4 w-4 rotate-90" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
