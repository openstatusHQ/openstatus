import { Icons } from "@/components/icons";
import { cn } from "@/lib/utils";

const steps = ["monitor", "status-page"] as const;
// potentially move to `config/onboarding`
const onboardingConfig = {
  monitor: {
    icon: "activity",
    name: "Monitor",
    description: [
      {
        title: "What is a monitor?",
        text: "A monitor is a website or api endpoint that you are going to ping on a regular basis.",
      },
      {
        title: "How to create monitors?",
        text: "You can create a monitor like you are about to via our dashboard or with our API. E.g. you can create a monitor for every instance you deploy programmatically.",
      },
    ],
  },
  "status-page": {
    icon: "panel-top",
    name: "Status Page",
    description: [
      {
        title: "How to use status pages?",
        text: "Add the monitors you'd like to track to a status page and inform your users if your services are down.",
      },
      {
        title: "Subdomain or custom domains?",
        text: "Start with a unique subdomain slug and move to your own custom domains afterwards by updating the DNS settings.",
      },
    ],
  },
} as const;

export function Description({
  step,
}: {
  step?: keyof typeof onboardingConfig;
}) {
  const config = step && onboardingConfig[step];
  return (
    <div className="flex h-full flex-col gap-6 border-border border-l pl-6 md:pl-8">
      <div className="flex gap-5">
        {steps.map((item, _i) => {
          const { icon, name } = onboardingConfig[item];
          const StepIcon = Icons[icon];
          const active = step === item;
          return (
            <div key={name} className="flex items-center gap-2">
              <div
                className={cn(
                  "max-w-max rounded-full border border-border p-2",
                  active && "border-accent-foreground",
                )}
              >
                <StepIcon className="h-4 w-4" />
              </div>
              <p
                className={cn(
                  "text-sm",
                  active
                    ? "font-semibold text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {name}
              </p>
            </div>
          );
        })}
      </div>
      {config?.description.map(({ title, text }) => {
        return (
          <dl key={title} className="grid gap-1">
            <dt className="font-medium">{title}</dt>
            <dd className="text-muted-foreground">{text}</dd>
          </dl>
        );
      })}
    </div>
  );
}
