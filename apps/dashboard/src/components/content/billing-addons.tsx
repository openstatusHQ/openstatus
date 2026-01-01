import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useCookieState } from "@/hooks/use-cookie-state";
import type { RouterOutputs } from "@openstatus/api";
import type { Addons } from "@openstatus/db/src/schema/plan/schema";
import { getAddonPriceConfig } from "@openstatus/db/src/schema/plan/utils";

type Workspace = RouterOutputs["workspace"]["get"];

interface BillingAddonsProps {
  label: string;
  description: React.ReactNode;
  addon: keyof Addons;
  workspace: Workspace;
  // TODO: onCheckedChange -> redirect to Stripe
}

export function BillingAddons({
  label,
  description,
  addon,
  workspace,
}: BillingAddonsProps) {
  const plan = workspace.plan;
  const value = workspace.limits[addon];
  const [currency] = useCookieState("x-currency", "USD");
  const price = getAddonPriceConfig(plan, addon, currency);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col justify-between gap-1.5 sm:flex-row">
        <div className="space-y-0.5 text-sm">
          <Label>{label}</Label>
          <div className="truncate text-muted-foreground">{description}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-foreground">
            {price
              ? new Intl.NumberFormat(price.locale, {
                  style: "currency",
                  currency: price.currency,
                }).format(price.value)
              : "N/A"}
            /mo.
          </span>
          <Switch defaultChecked={value} />
        </div>
      </div>
    </div>
  );
}
