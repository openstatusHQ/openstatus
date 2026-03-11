"use client";

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
        <div className="absolute right-0 top-1/2 hidden h-px w-12 -translate-y-1/2 translate-x-full border-t border-dashed border-border/50 md:block" />
      )}

      <div className="flex h-full flex-col gap-4 rounded-md border border-border bg-background p-5 transition-colors hover:border-border/80">
        {/* Number badge */}
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-success/30 bg-success/10 text-xs font-medium text-success">
          {step.number}
        </span>

        {/* Icon */}
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-success/10 text-success">
          <Icon className="h-5 w-5" />
        </div>

        {/* Content */}
        <div className="flex flex-col gap-1.5">
          <h3 className="text-base font-medium text-foreground">{step.title}</h3>
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
    <section className="not-prose my-10">
      {/* Header */}
      <div className="mx-auto mb-8 max-w-2xl text-center">
        <h2 className="text-xl font-medium tracking-tight text-foreground md:text-2xl">
          How it works
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Get started with OpenStatus in three simple steps
        </p>
      </div>

      {/* Steps */}
      <div className="mx-auto flex max-w-4xl flex-col gap-4 md:flex-row md:gap-12">
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
