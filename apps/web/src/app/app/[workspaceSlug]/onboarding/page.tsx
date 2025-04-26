import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@openstatus/ui/src/components/button";

import { Header } from "@/components/dashboard/header";
import { MonitorForm } from "@/components/forms/onboarding/monitor-form";
import { StatusPageForm } from "@/components/forms/onboarding/status-page-form";
import { api } from "@/trpc/server";
import {
  Stepper,
  StepperIndicator,
  StepperItem,
  StepperTitle,
} from "@openstatus/ui";
import { Check } from "lucide-react";

export default async function Onboarding(props: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const params = await props.params;
  const { workspaceSlug } = params;

  const allMonitors = await api.monitor.getMonitorsByWorkspace.query();
  const allPages = await api.page.getPagesByWorkspace.query();

  const hasMonitor = allMonitors.length > 0;
  const firstMonitor = hasMonitor ? allMonitors[0] : null;
  const pageSlug = firstMonitor?.url
    ?.replace(/^.*?:\/\//, "")
    .replace(/\.[^.]*$/, "")
    .replaceAll(".", "-");

  const hasPage = allPages.length > 0;

  const defaultStep = hasMonitor ? 3 : 1;

  return (
    <div className="flex h-full w-full flex-col gap-6 md:gap-8">
      <Header
        title="Onboarding"
        description="Let's get you started with OpenStatus. You'll be able to update any of these entries later."
        actions={
          // TODO: add tooltip to skip button
          <Button variant="link" className="text-muted-foreground" asChild>
            <Link href={`/app/${workspaceSlug}/monitors`}>Skip</Link>
          </Button>
        }
      />
      <div className="flex flex-1 flex-col items-center justify-center gap-6 md:gap-8 max-w-xl mx-auto">
        <OnboardingStepper defaultStep={defaultStep} />
        {(() => {
          switch (defaultStep) {
            case 1:
              return <MonitorForm />;
            case 3:
              return <StatusPageForm defaultValues={{ slug: pageSlug }} />;
            default:
              return <>Missing Step</>;
          }
        })()}
        <p className="text-xs text-muted-foreground">
          Do you need help to set it up?
          <Button variant="link" size="sm" className="px-1" asChild>
            <Link href="/cal" rel="noreferrer" target="_blank">
              Book a call
            </Link>
          </Button>
        </p>
      </div>
    </div>
  );

  // return redirect(`/app/${workspaceSlug}/monitors`);
}

const steps = [
  {
    step: 1,
    title: "Create Monitor",
  },
  {
    step: 2,
    title: "Run Check",
    icon: <Check className="w-4 h-4 text-green-500" />,
  },
  {
    step: 3,
    title: "Create Status Page",
  },
];

function OnboardingStepper({ defaultStep }: { defaultStep?: number }) {
  return (
    <Stepper defaultValue={defaultStep} className="items-start gap-4 max-w-xl">
      {steps.map(({ step, title, icon }) => (
        <StepperItem key={step} step={step} className="flex-1">
          <div className="w-full flex-col items-start gap-2 rounded">
            <StepperIndicator asChild className="bg-border h-1 w-full">
              <span className="sr-only">{step}</span>
            </StepperIndicator>
            <div className="flex items-center gap-1.5">
              <StepperTitle>{title}</StepperTitle>
              {icon && defaultStep && defaultStep >= step ? <>{icon}</> : null}
            </div>
          </div>
        </StepperItem>
      ))}
    </Stepper>
  );
}
