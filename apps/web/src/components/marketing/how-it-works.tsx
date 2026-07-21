import { Bell, Globe, Monitor } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@openstatus/ui/components/ui/card";

import { cn } from "@/lib/utils";

type Step = {
  icon: LucideIcon;
  title: string;
  description: string;
  status: string;
};

const steps: Step[] = [
  {
    icon: Monitor,
    title: "Add your monitors",
    description:
      "Connect your websites and APIs in seconds. Set your check frequency and regions.",
    status: "Monitoring active",
  },
  {
    icon: Bell,
    title: "Get notified instantly",
    description:
      "Receive alerts via email, Slack, or SMS the moment downtime is detected.",
    status: "Alerts enabled",
  },
  {
    icon: Globe,
    title: "Share your status",
    description:
      "Publish a beautiful public status page to keep your users informed.",
    status: "Page published",
  },
];

export function HowItWorks() {
  return (
    <section
      aria-labelledby="how-it-works-heading"
      className="not-prose my-16 rounded-2xl border bg-muted/40 px-4 py-14 sm:px-8"
    >
      <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
        <h2
          id="how-it-works-heading"
          className="text-balance font-cal text-3xl sm:text-4xl"
        >
          How it works
        </h2>
        <p className="mt-3 text-pretty text-muted-foreground leading-relaxed">
          Go from zero to full observability in three simple steps.
        </p>
      </div>

      <div className="relative mx-auto mt-12 grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-3">
        {/* Connecting dotted line across steps on desktop */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-9 hidden items-center justify-between px-[16.6%] md:flex"
        >
          <div className="h-px w-full border-t border-green-500/30 border-dashed" />
        </div>

        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <div key={step.title} className="relative flex flex-col">
              <Card className="relative h-full overflow-hidden bg-background transition-colors hover:border-green-500/40">
                {/* Green accent bar along the top */}
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 top-0 h-0.5 bg-green-500"
                />
                {/* Numbered badge */}
                <span
                  aria-hidden="true"
                  className="-top-3 -right-3 absolute flex h-8 w-8 items-center justify-center rounded-full border border-green-500/30 bg-green-500/10 font-medium text-green-600 text-sm shadow-sm dark:text-green-400"
                >
                  {index + 1}
                </span>
                <CardHeader>
                  <span
                    className={cn(
                      "mb-2 flex h-11 w-11 items-center justify-center rounded-lg",
                      "border border-green-500/20 bg-green-500/10 text-green-600 dark:text-green-400",
                    )}
                  >
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    {step.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <CardDescription className="text-pretty leading-relaxed">
                    {step.description}
                  </CardDescription>
                  {/* Small operational-style status detail */}
                  <span className="inline-flex items-center gap-1.5 font-medium text-green-600 text-xs dark:text-green-400">
                    <span
                      aria-hidden="true"
                      className="relative flex h-2 w-2"
                    >
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                    </span>
                    {step.status}
                  </span>
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>
    </section>
  );
}
