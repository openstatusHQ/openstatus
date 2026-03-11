import { Bell, Globe, Monitor, ArrowRight } from "lucide-react";

const steps = [
  {
    step: 1,
    title: "Add your monitors",
    description:
      "Connect your websites and APIs in seconds. Set your check frequency and regions.",
    icon: Monitor,
    color: {
      border: "border-l-blue-500",
      badge: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30",
      icon: "text-blue-600 dark:text-blue-400",
    },
  },
  {
    step: 2,
    title: "Get notified instantly",
    description:
      "Receive alerts via email, Slack, or SMS the moment downtime is detected.",
    icon: Bell,
    color: {
      border: "border-l-amber-500",
      badge: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
      icon: "text-amber-600 dark:text-amber-400",
    },
  },
  {
    step: 3,
    title: "Share your status",
    description:
      "Publish a beautiful public status page to keep your users informed.",
    icon: Globe,
    color: {
      border: "border-l-green-500",
      badge: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30",
      icon: "text-green-600 dark:text-green-400",
    },
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
      <div className="relative grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-0">
        {steps.map((step, index) => (
          <div
            key={step.step}
            className={`relative flex flex-col border-2 border-border bg-background p-6 transition-all hover:bg-muted/30 ${step.color.border} border-l-4`}
          >
            {/* Step number badge */}
            <div className="mb-4 flex items-start justify-between">
              <span
                className={`flex h-8 w-8 items-center justify-center border font-mono text-sm font-semibold ${step.color.badge}`}
              >
                {step.step}
              </span>
              <step.icon className={`h-6 w-6 ${step.color.icon}`} />
            </div>

            {/* Content */}
            <h3 className="mb-2 font-medium text-foreground">{step.title}</h3>
            <p className="text-sm text-muted-foreground">{step.description}</p>

            {/* Connecting arrow (visible on desktop, between cards) */}
            {index < steps.length - 1 && (
              <div className="absolute right-0 top-1/2 z-10 hidden -translate-y-1/2 translate-x-1/2 md:block">
                <div className="flex items-center rounded-full border border-border bg-background p-1.5">
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </div>
            )}

            {/* Mobile vertical connector */}
            {index < steps.length - 1 && (
              <div className="absolute -bottom-4 left-1/2 z-10 -translate-x-1/2 md:hidden">
                <div className="flex h-4 flex-col items-center justify-center">
                  <span className="h-full w-0.5 bg-border" />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
