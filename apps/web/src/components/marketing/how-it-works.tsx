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
    <section className="not-prose -mx-4 border-y border-border bg-muted/30 py-12 md:py-16">
      <div className="mx-auto max-w-5xl px-4">
        {/* Heading */}
        <div className="mb-10 text-center md:mb-14">
          <h2 className="text-2xl font-medium tracking-tight text-foreground md:text-3xl">
            How it works
          </h2>
          <p className="mt-2 text-sm text-muted-foreground md:text-base">
            Get up and running in minutes — no complex setup required.
          </p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 gap-px border border-border bg-border md:grid-cols-3">
          {steps.map((step, index) => (
            <div
              key={step.number}
              className="relative flex flex-col gap-4 bg-background p-6 md:p-8"
            >
              {/* Connecting arrow on desktop - shown between cards */}
              {index < steps.length - 1 && (
                <div className="absolute -right-px top-1/2 z-10 hidden -translate-y-1/2 translate-x-1/2 md:flex">
                  <div className="flex items-center gap-0.5">
                    <span className="text-xs tracking-widest text-muted-foreground/60">
                      {"..."}
                    </span>
                    <span className="text-xs text-muted-foreground/60">
                      {"\u203A"}
                    </span>
                  </div>
                </div>
              )}

              {/* Number badge */}
              <div className="flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center border border-border bg-muted text-xs font-medium text-muted-foreground">
                  {step.number}
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>

              {/* Icon */}
              <div className="flex h-10 w-10 items-center justify-center border border-border bg-muted/50">
                <step.icon className="h-5 w-5 text-foreground" strokeWidth={1.5} />
              </div>

              {/* Content */}
              <div>
                <h3 className="text-base font-medium text-foreground">
                  {step.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
