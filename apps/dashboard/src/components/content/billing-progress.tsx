import { Progress } from "@/components/ui/progress";

interface BillingProgressProps {
  label: string;
  value: number;
  max: number;
}

export function BillingProgress({ label, value, max }: BillingProgressProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <div className="text-sm text-muted-foreground flex justify-between">
          <div className="font-medium">{label}</div>
          <div className="font-mono">
            <span className="text-foreground">{value}</span>/{max}
          </div>
        </div>
        <Progress value={(value / max) * 100} />
      </div>
    </div>
  );
}
