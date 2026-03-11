"use client";

import { cn } from "@/lib/utils";
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

function StepCard({
  step,
  isLast,
}: {
  step: (typeof steps)[0];
  isLast: boolean;
}) {
  const Icon = step.icon;

  return (
    <div className="relative flex flex-1 flex-col">
      {/* Connecting line - desktop only */}
      {!isLast && (
        <div className="absolute right-0 top-1/2 hidden h-px w-8 -translate-y-1/2 translate-x-full border-t-2 border-dashed border-border md:block" />
      )}

      <div
        className={cn(
          "group relative flex h-full flex-col gap-4 rounded-lg border border-border bg-card p-6",
          "transition-all duration-200 hover:border-foreground/20 hover:shadow-md"
        )}
      >
        {/* Number badge */}
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
          {step.number}
        </span>

        {/* Icon */}
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
          <Icon className="h-6 w-6" />
        </div>

        {/* Content */}
        <div className="flex flex-col gap-2">
          <h3 className="text-lg font-semibold text-foreground">{step.title}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {step.description}
          </p>
        </div>
      </div>
    </div>
  );
}

export function HowItWorks() {
  return (
    <section className="not-prose my-12 rounded-lg bg-muted/50 px-6 py-12">
      {/* Header */}
      <div className="mx-auto mb-10 max-w-2xl text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
          How it works
        </h2>
        <p className="mt-3 text-muted-foreground">
          Get started with OpenStatus in three simple steps
        </p>
      </div>

      {/* Steps */}
      <div className="mx-auto flex max-w-4xl flex-col gap-6 md:flex-row md:gap-8">
        {steps.map((step, index) => (
          <StepCard
            key={step.number}
            step={step}
            isLast={index === steps.length - 1}
          />
        ))}
      </div>
    </section>
  );
}
