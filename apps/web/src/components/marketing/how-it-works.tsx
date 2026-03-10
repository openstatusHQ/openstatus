import { Monitor, Bell, Globe, ArrowRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@openstatus/ui/components/ui/card";
import { cn } from "@openstatus/ui/lib/utils";

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
    <section className="w-full bg-muted/50 py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4">
        {/* Header */}
        <div className="mb-12 text-center md:mb-16">
          <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            How it works
          </h2>
          <p className="mt-3 text-muted-foreground md:text-lg">
            Get started with OpenStatus in three simple steps
          </p>
        </div>

        {/* Steps Grid */}
        <div className="relative grid gap-6 md:grid-cols-3 md:gap-8">
          {/* Connecting lines - desktop only */}
          <div
            className="absolute top-16 right-1/3 left-1/3 hidden h-0.5 border-t-2 border-dashed border-border md:block"
            aria-hidden="true"
          />

          {steps.map((step, index) => (
            <div key={step.step} className="relative">
              {/* Mobile connector arrow */}
              {index < steps.length - 1 && (
                <div
                  className="absolute -bottom-3 left-1/2 -translate-x-1/2 md:hidden"
                  aria-hidden="true"
                >
                  <ArrowRight className="h-5 w-5 rotate-90 text-muted-foreground/50" />
                </div>
              )}

              <Card
                className={cn(
                  "relative h-full border-border/50 bg-card transition-shadow hover:shadow-md"
                )}
              >
                {/* Step number badge */}
                <div className="absolute -top-3 left-6">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground shadow-sm">
                    {step.step}
                  </span>
                </div>

                <CardHeader className="pt-8">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                    <step.icon className="h-6 w-6 text-foreground" />
                  </div>
                  <CardTitle className="text-lg font-semibold">
                    {step.title}
                  </CardTitle>
                </CardHeader>

                <CardContent className="pt-0">
                  <CardDescription className="text-sm leading-relaxed">
                    {step.description}
                  </CardDescription>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
