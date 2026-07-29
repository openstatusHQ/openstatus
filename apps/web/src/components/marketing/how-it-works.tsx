import { Bell, Globe, Monitor } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@openstatus/ui/components/ui/card";

import { cn } from "../../lib/utils";

const steps = [
  {
    icon: Monitor,
    title: "Add your monitors",
    description:
      "Connect your websites and APIs in seconds. Set your check frequency and regions.",
  },
  {
    icon: Bell,
    title: "Get notified instantly",
    description:
      "Receive alerts via email, Slack, or SMS the moment downtime is detected.",
  },
  {
    icon: Globe,
    title: "Share your status",
    description:
      "Publish a beautiful public status page to keep your users informed.",
  },
];

export function HowItWorks() {
  return (
    <section
      aria-labelledby="how-it-works-heading"
      className="not-prose my-16 rounded-2xl border bg-muted/40 px-6 py-14 sm:px-10"
    >
      <div className="mx-auto max-w-2xl text-center">
        <h2
          id="how-it-works-heading"
          className="text-balance font-cal text-3xl sm:text-4xl"
        >
          How it works
        </h2>
        <p className="mt-3 text-pretty text-muted-foreground leading-relaxed">
          Go from zero to a fully monitored, publicly shareable status page in
          three simple steps.
        </p>
      </div>

      <div className="relative mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-3">
        {/* Connecting dotted line across steps on desktop */}
        <div
          aria-hidden="true"
          className="absolute inset-x-[16%] top-10 hidden border-border border-t-2 border-dashed md:block"
        />

        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <div key={step.title} className="relative flex">
              <Card className="relative z-10 flex w-full flex-col bg-background text-center">
                <CardHeader className="items-center gap-4">
                  <div className="relative">
                    <div className="flex size-14 items-center justify-center rounded-xl border bg-muted">
                      <Icon
                        className="size-6 text-foreground"
                        aria-hidden="true"
                      />
                    </div>
                    <span
                      className="-right-2 -top-2 absolute flex size-6 items-center justify-center rounded-full bg-foreground font-medium text-background text-xs"
                      aria-hidden="true"
                    >
                      {index + 1}
                    </span>
                  </div>
                  <CardTitle className="text-lg">{step.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-pretty text-muted-foreground text-sm leading-relaxed">
                    {step.description}
                  </p>
                </CardContent>
              </Card>

              {/* Arrow between cards on desktop */}
              {index < steps.length - 1 ? (
                <div
                  aria-hidden="true"
                  className={cn(
                    "absolute top-10 right-0 z-20 hidden translate-x-1/2 md:block",
                    "flex size-6 items-center justify-center rounded-full border bg-background text-muted-foreground",
                  )}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="size-3.5"
                  >
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                  </svg>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
