import { Bell, Globe, Monitor } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@openstatus/ui/components/ui/card";

import { cn } from "../../lib/utils";

type Step = {
  icon: LucideIcon;
  title: string;
  description: string;
};

const steps: Step[] = [
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
      className="not-prose bg-muted/40 rounded-2xl border px-6 py-16 sm:px-10 sm:py-20"
    >
      <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-green-500/10 px-3 py-1 text-xs font-medium text-green-700 ring-1 ring-green-500/20 dark:text-green-400">
          <span className="size-1.5 rounded-full bg-green-500" aria-hidden="true" />
          Get started
        </span>
        <h2
          id="how-it-works-heading"
          className="text-foreground mt-4 text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
        >
          How it works
        </h2>
        <p className="text-muted-foreground mt-3 text-base leading-relaxed text-pretty sm:text-lg">
          Get up and running in three simple steps, from your first monitor to a
          public status page.
        </p>
      </div>

      <ol className="mx-auto mt-12 grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-3 md:gap-4">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isLast = index === steps.length - 1;

          return (
            <li key={step.title} className="relative flex">
              <Card className="w-full text-center transition-colors hover:border-green-500/40">
                <CardHeader className="flex flex-col items-center gap-4">
                  <div className="relative">
                    <div className="flex size-14 items-center justify-center rounded-full bg-green-500/10 text-green-600 ring-1 ring-green-500/20 dark:text-green-400">
                      <Icon className="size-7" aria-hidden="true" />
                    </div>
                    <span
                      className="absolute -top-1 -right-1 flex size-6 items-center justify-center rounded-full bg-green-600 text-xs font-semibold text-white dark:bg-green-500 dark:text-black"
                      aria-hidden="true"
                    >
                      {index + 1}
                    </span>
                  </div>
                  <CardTitle className="text-lg">
                    <span className="sr-only">{`Step ${index + 1}: `}</span>
                    {step.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="leading-relaxed">
                    {step.description}
                  </CardDescription>
                </CardContent>
              </Card>

              {!isLast ? (
                <div
                  aria-hidden="true"
                  className={cn(
                    "pointer-events-none absolute top-1/2 right-0 hidden translate-x-1/2 -translate-y-1/2 md:flex md:items-center",
                  )}
                >
                  <span className="h-0 w-8 border-t border-dashed border-green-500/50" />
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="-ml-1 size-4 text-green-500/70"
                  >
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                  </svg>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
