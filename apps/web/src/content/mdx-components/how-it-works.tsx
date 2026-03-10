import { cn } from "@/lib/utils";
import { Bell, Globe, Monitor } from "lucide-react";

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
    <section className="not-prose -mx-4 my-8 bg-muted/50 px-4 py-12 md:py-16">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-10 text-center md:mb-12">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            How it works
          </h2>
          <p className="mt-2 text-muted-foreground">
            Get started with OpenStatus in three simple steps
          </p>
        </div>

        {/* Steps Grid */}
        <div className="relative grid gap-8 md:grid-cols-3 md:gap-6">
          {/* Connecting dotted line - desktop only */}
          <div
            className="absolute top-14 right-[16.67%] left-[16.67%] hidden h-px border-t-2 border-dashed border-border md:block"
            aria-hidden="true"
          />

          {steps.map((step, index) => (
            <div key={step.step} className="relative">
              {/* Mobile connector */}
              {index < steps.length - 1 && (
                <div
                  className="absolute -bottom-4 left-1/2 h-4 w-px -translate-x-1/2 border-l-2 border-dashed border-border md:hidden"
                  aria-hidden="true"
                />
              )}

              <div
                className={cn(
                  "relative flex h-full flex-col border border-border bg-background p-6 transition-shadow hover:shadow-md"
                )}
              >
                {/* Step number badge */}
                <div className="absolute -top-3 left-6">
                  <span className="inline-flex h-6 w-6 items-center justify-center bg-foreground text-xs font-semibold text-background">
                    {step.step}
                  </span>
                </div>

                {/* Icon */}
                <div className="mb-4 mt-2 flex h-10 w-10 items-center justify-center bg-muted">
                  <step.icon className="h-5 w-5 text-foreground" />
                </div>

                {/* Content */}
                <h3 className="text-base font-medium text-foreground">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
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
