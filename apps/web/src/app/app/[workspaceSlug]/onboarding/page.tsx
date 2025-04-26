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
  StepperTrigger,
} from "@openstatus/ui";
import type { SearchParams } from "nuqs";
import { RunCheck } from "./_components/run-check";
import { searchParamsCache } from "./search-params";

export default async function Onboarding(props: {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const params = await props.params;
  const { workspaceSlug } = params;
  const searchParams = await props.searchParams;
  const search = searchParamsCache.parse(searchParams);

  const workspace = await api.workspace.getWorkspace.query();
  const allMonitors = await api.monitor.getMonitorsByWorkspace.query();
  const allPages = await api.page.getPagesByWorkspace.query();

  const hasMonitor = allMonitors.length > 0;
  const firstMonitor = hasMonitor ? allMonitors[0] : undefined;
  const pageSlug = firstMonitor?.url
    ?.replace(/^.*?:\/\//, "")
    .replace(/\.[^.]*$/, "")
    .replaceAll(".", "-");

  const hasPage = allPages.length > 0;

  const currentStep = search.step ?? (!hasMonitor ? 1 : 2);

  if (hasPage) {
    return redirect(`/app/${workspaceSlug}/monitors`);
  }

  return (
    <div className="flex h-full w-full flex-col gap-6 md:gap-8">
      <Header
        title="Onboarding"
        description="Let's get you started with OpenStatus. You'll be able to update any of these entries later."
        actions={
          <Button variant="link" className="text-muted-foreground" asChild>
            <Link href={`/app/${workspaceSlug}/monitors`}>Skip</Link>
          </Button>
        }
      />

      <div className="col-span-full w-full rounded-lg border border-border border-dashed bg-background p-8">
        <div className="grid gap-4 md:gap-6 max-w-xl w-full mx-auto">
          <OnboardingStepper currentStep={currentStep} />
          <div className="w-full">
            {(() => {
              switch (currentStep) {
                case 1:
                  return (
                    <MonitorForm
                      limits={workspace.limits}
                      defaultValues={firstMonitor}
                      toStep={2}
                    />
                  );
                case 2:
                  return (
                    <RunCheck
                      url={firstMonitor?.url || ""}
                      limits={workspace.limits}
                      toStep={3}
                    />
                  );
                case 3:
                  return (
                    <StatusPageForm
                      defaultValues={{
                        slug: pageSlug || "",
                        monitors: firstMonitor
                          ? [{ monitorId: firstMonitor.id }]
                          : undefined,
                      }}
                      toStep={4}
                    />
                  );
                default:
                  return redirect(`/app/${workspaceSlug}/monitors`);
              }
            })()}
          </div>
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
    </div>
  );
}

const steps = [
  {
    step: 1,
    title: "Create Monitor",
  },
  {
    step: 2,
    title: "Run Check",
  },
  {
    step: 3,
    title: "Create Status Page",
  },
];

function OnboardingStepper({ currentStep }: { currentStep: number }) {
  return (
    <Stepper value={currentStep} className="items-start gap-4 max-w-xl">
      {steps.map(({ step, title }) => (
        <StepperItem key={step} step={step} className="flex-1">
          {step >= currentStep ? (
            <div className="w-full flex-col items-start gap-2 rounded">
              <StepperIndicator asChild className="bg-border h-1 w-full">
                <span className="sr-only">{step}</span>
              </StepperIndicator>
              <StepperTitle>{title}</StepperTitle>
            </div>
          ) : (
            <StepperTrigger
              className="w-full flex-col items-start gap-2 rounded"
              asChild
            >
              <Link href={`?step=${step}`}>
                <StepperIndicator asChild className="bg-border h-1 w-full">
                  <span className="sr-only">{step}</span>
                </StepperIndicator>
                <StepperTitle>{title}</StepperTitle>
              </Link>
            </StepperTrigger>
          )}
        </StepperItem>
      ))}
    </Stepper>
  );
}
