import { Bell, Globe, Monitor } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@openstatus/ui/components/ui/card";

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
    <section className="bg-muted/50 py-16 md:py-24">
      <div className="container mx-auto max-w-6xl px-4">
        {/* Header */}
        <div className="mb-12 text-center md:mb-16">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            How it works
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
            Get started in minutes with three simple steps to monitor your
            services and keep your users informed.
          </p>
        </div>

        {/* Steps */}
        <div className="relative grid gap-8 md:grid-cols-3 md:gap-6">
          {/* Connecting line - desktop only */}
          <div
            className="absolute left-0 right-0 top-[88px] hidden h-px md:block"
            aria-hidden="true"
          >
            <div className="mx-auto flex w-full max-w-[calc(100%-200px)] items-center justify-between px-16">
              <div className="h-px flex-1 border-t-2 border-dashed border-success/40" />
              <div className="mx-4 text-success">
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
              <div className="h-px flex-1 border-t-2 border-dashed border-success/40" />
              <div className="mx-4 text-success">
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
              <div className="h-px flex-1 border-t-2 border-dashed border-success/40" />
            </div>
          </div>

          {steps.map((step) => (
            <Card
              key={step.step}
              className="relative border-border bg-card shadow-sm"
            >
              {/* Step badge */}
              <div className="absolute -top-3 left-6">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-success text-xs font-medium text-white">
                  {step.step}
                </span>
              </div>

              <CardHeader className="pt-8">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-success/10">
                  <step.icon className="h-6 w-6 text-success" />
                </div>
                <CardTitle className="text-lg">{step.title}</CardTitle>
              </CardHeader>

              <CardContent>
                <CardDescription className="text-sm leading-relaxed">
                  {step.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
