"use client";

import { Details } from "@/content/mdx-components/details";
import { Button } from "@openstatus/ui/components/ui/button";
import { Checkbox } from "@openstatus/ui/components/ui/checkbox";
import { Input } from "@openstatus/ui/components/ui/input";
import { Label } from "@openstatus/ui/components/ui/label";
import { Slider } from "@openstatus/ui/components/ui/slider";
import { useState } from "react";

type SeverityLevel = "SEV0" | "SEV1" | "SEV2" | "SEV3";

const SEV_ORDER = ["SEV0", "SEV1", "SEV2", "SEV3"] as const;

const SEVERITY_META = {
  SEV0: {
    label: "Critical",
    emoji: "🔴",
    responseTime: "15 minutes",
    statusPageLabel: "Major Outage",
    communication: "Immediate public update + all-hands",
    updateCadence: "Every 15 min",
    escalation: "VP Engineering + on-call",
    postmortem: "Required",
  },
  SEV1: {
    label: "High",
    emoji: "🟠",
    responseTime: "30 minutes",
    statusPageLabel: "Partial Outage",
    communication: "Public update within 15 min",
    updateCadence: "Every 30 min",
    escalation: "Engineering lead",
    postmortem: "Required",
  },
  SEV2: {
    label: "Medium",
    emoji: "🟡",
    responseTime: "2 hours",
    statusPageLabel: "Degraded Performance",
    communication: "Status page update + ticket",
    updateCadence: "Every 2 hours",
    escalation: "Team lead",
    postmortem: "Required (team)",
  },
  SEV3: {
    label: "Low",
    emoji: "🟢",
    responseTime: "1 business day",
    statusPageLabel: "Minor Issue",
    communication: "Internal ticket only",
    updateCadence: "Daily",
    escalation: "Assigned engineer",
    postmortem: "Optional",
  },
} satisfies Record<
  SeverityLevel,
  {
    label: string;
    emoji: string;
    responseTime: string;
    statusPageLabel: string;
    communication: string;
    updateCadence: string;
    escalation: string;
    postmortem: string;
  }
>;

const SEVERITY_BORDER: Record<SeverityLevel, string> = {
  SEV0: "border-red-500",
  SEV1: "border-orange-500",
  SEV2: "border-yellow-500",
  SEV3: "border-green-500",
};

const TEST_SCENARIOS = [
  {
    label: "DB Failover",
    usersAffected: 60,
    securityImpact: false,
    slaBreach: false,
  },
  {
    label: "API Auth Breach",
    usersAffected: 5,
    securityImpact: true,
    slaBreach: false,
  },
  {
    label: "CDN Degradation",
    usersAffected: 15,
    securityImpact: false,
    slaBreach: false,
  },
  {
    label: "Payment Timeout",
    usersAffected: 90,
    securityImpact: false,
    slaBreach: true,
  },
  {
    label: "CSS Regression",
    usersAffected: 5,
    securityImpact: false,
    slaBreach: false,
  },
] as const;

function classifySeverity(params: {
  usersAffected: number;
  securityImpact: boolean;
  slaBreach: boolean;
  thresholdCritical: number;
  thresholdHigh: number;
  thresholdMedium: number;
}): SeverityLevel {
  const {
    usersAffected,
    securityImpact,
    slaBreach,
    thresholdCritical,
    thresholdHigh,
    thresholdMedium,
  } = params;

  if (securityImpact) return "SEV0";

  let sev: SeverityLevel;
  if (usersAffected >= thresholdCritical) sev = "SEV0";
  else if (usersAffected >= thresholdHigh) sev = "SEV1";
  else if (usersAffected >= thresholdMedium) sev = "SEV2";
  else sev = "SEV3";

  // SLA modifier: upgrade one level if severity is below SEV1
  if (slaBreach && (sev === "SEV2" || sev === "SEV3")) {
    sev = SEV_ORDER[SEV_ORDER.indexOf(sev) - 1];
  }

  return sev;
}

function classifyReason(params: {
  usersAffected: number;
  securityImpact: boolean;
  slaBreach: boolean;
  thresholdCritical: number;
  thresholdHigh: number;
  thresholdMedium: number;
}): string {
  const {
    usersAffected,
    securityImpact,
    slaBreach,
    thresholdCritical,
    thresholdHigh,
    thresholdMedium,
  } = params;

  if (securityImpact) return "Security impact override";

  if (usersAffected >= thresholdCritical)
    return `≥${thresholdCritical}% users affected`;
  if (usersAffected >= thresholdHigh) {
    // SLA breach doesn't affect SEV1+ — only upgrades SEV2/SEV3
    return `≥${thresholdHigh}% users affected`;
  }
  if (usersAffected >= thresholdMedium) {
    if (slaBreach)
      return `≥${thresholdMedium}% users affected + SLA breach (upgraded)`;
    return `≥${thresholdMedium}% users affected`;
  }
  if (slaBreach)
    return `<${thresholdMedium}% users affected + SLA breach (upgraded)`;
  return `<${thresholdMedium}% users affected`;
}

type Values = {
  usersAffected: number;
  securityImpact: boolean;
  slaBreach: boolean;
  thresholdCritical: number;
  thresholdHigh: number;
  thresholdMedium: number;
};

const defaultValues: Values = {
  usersAffected: 15,
  securityImpact: false,
  slaBreach: false,
  thresholdCritical: 80,
  thresholdHigh: 50,
  thresholdMedium: 10,
};

export function SeverityMatrixBuilder() {
  const [value, setValue] = useState<Values>(defaultValues);

  const severity = classifySeverity(value);
  const reason = classifyReason(value);
  const meta = SEVERITY_META[severity];
  const thresholdsOrdered =
    value.thresholdMedium < value.thresholdHigh &&
    value.thresholdHigh < value.thresholdCritical;

  return (
    <div className="not-prose space-y-8">
      {/* Calculator */}
      <div className="space-y-4">
        {/* Result */}
        <div className={`space-y-3 border-2 p-4 ${SEVERITY_BORDER[severity]}`}>
          <div className="space-y-1">
            <p className="mt-0! font-medium font-mono text-2xl">
              {meta.emoji} {severity} – {meta.label}
            </p>
            <p className="text-muted-foreground text-sm">{reason}</p>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Response time</dt>
              <dd className="font-medium text-foreground">
                {meta.responseTime}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Update cadence</dt>
              <dd className="font-medium text-foreground">
                {meta.updateCadence}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Postmortem</dt>
              <dd className="font-medium text-foreground">{meta.postmortem}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Status page</dt>
              <dd className="font-medium text-foreground">
                {meta.statusPageLabel}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Escalation</dt>
              <dd className="font-medium text-foreground">{meta.escalation}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Communication</dt>
              <dd className="font-medium text-foreground">
                {meta.communication}
              </dd>
            </div>
          </dl>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-base" htmlFor="users-affected">
              Users affected
            </Label>
            <span className="font-medium font-mono text-base text-foreground">
              {value.usersAffected}%
            </span>
          </div>
          <Slider
            id="users-affected"
            value={[value.usersAffected]}
            onValueChange={(values) =>
              setValue((v) => ({ ...v, usersAffected: values[0] }))
            }
            className="[&_[data-slot=slider-thumb]]:size-5 [&_[data-slot=slider-thumb]]:rounded-none [&_[data-slot=slider-track]]:rounded-none"
            min={0}
            max={100}
            step={5}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-start space-x-3">
            <Checkbox
              id="security-impact"
              checked={value.securityImpact}
              onCheckedChange={(checked) =>
                setValue((v) => ({ ...v, securityImpact: checked === true }))
              }
              className="size-5 rounded-none [&_svg]:size-4"
            />
            <Label
              htmlFor="security-impact"
              className="flex flex-col items-start gap-0 text-base"
            >
              <span>Security impact</span>
              <span className="text-muted-foreground">
                Confirmed security or data breach
              </span>
            </Label>
          </div>
          <div className="flex items-start space-x-3">
            <Checkbox
              id="sla-breach"
              checked={value.slaBreach}
              onCheckedChange={(checked) =>
                setValue((v) => ({ ...v, slaBreach: checked === true }))
              }
              className="size-5 rounded-none [&_svg]:size-4"
            />
            <Label
              htmlFor="sla-breach"
              className="flex flex-col items-start gap-0 text-base"
            >
              <span>SLA breach</span>
              <span className="text-muted-foreground">
                Active contractual SLA at risk
              </span>
            </Label>
          </div>
        </div>
      </div>

      {/* Test Scenarios */}
      <div className="space-y-2">
        <Label className="text-base">Test scenarios</Label>
        <div className="flex flex-wrap gap-2">
          {TEST_SCENARIOS.map((scenario) => {
            const isActive =
              scenario.usersAffected === value.usersAffected &&
              scenario.securityImpact === value.securityImpact &&
              scenario.slaBreach === value.slaBreach;
            return (
              <Button
                key={scenario.label}
                type="button"
                size="sm"
                variant={isActive ? "default" : "outline"}
                className="rounded-none"
                onClick={() =>
                  setValue((v) => ({
                    ...v,
                    usersAffected: scenario.usersAffected,
                    securityImpact: scenario.securityImpact,
                    slaBreach: scenario.slaBreach,
                  }))
                }
              >
                {scenario.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Customize Thresholds */}
      <Details summary="Customize thresholds">
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label
              htmlFor="threshold-critical"
              className="text-muted-foreground text-sm"
            >
              SEV0 ≥
            </Label>
            <div className="relative">
              <Input
                id="threshold-critical"
                type="number"
                min={0}
                step={5}
                max={100}
                value={value.thresholdCritical}
                onChange={(e) =>
                  setValue((v) => ({
                    ...v,
                    thresholdCritical: Number(e.target.value),
                  }))
                }
                className="h-auto! rounded-none p-4 pr-8 text-base md:text-base"
              />
              <span className="-translate-y-1/2 pointer-events-none absolute top-1/2 right-4 text-muted-foreground">
                %
              </span>
            </div>
          </div>
          <div className="space-y-1">
            <Label
              htmlFor="threshold-high"
              className="text-muted-foreground text-sm"
            >
              SEV1 ≥
            </Label>
            <div className="relative">
              <Input
                id="threshold-high"
                type="number"
                min={0}
                step={5}
                max={100}
                value={value.thresholdHigh}
                onChange={(e) =>
                  setValue((v) => ({
                    ...v,
                    thresholdHigh: Number(e.target.value),
                  }))
                }
                className="h-auto! rounded-none p-4 pr-8 text-base md:text-base"
              />
              <span className="-translate-y-1/2 pointer-events-none absolute top-1/2 right-4 text-muted-foreground">
                %
              </span>
            </div>
          </div>
          <div className="space-y-1">
            <Label
              htmlFor="threshold-medium"
              className="text-muted-foreground text-sm"
            >
              SEV2 ≥
            </Label>
            <div className="relative">
              <Input
                id="threshold-medium"
                type="number"
                min={0}
                step={5}
                max={100}
                value={value.thresholdMedium}
                onChange={(e) =>
                  setValue((v) => ({
                    ...v,
                    thresholdMedium: Number(e.target.value),
                  }))
                }
                className="h-auto! rounded-none p-4 pr-8 text-base md:text-base"
              />
              <span className="-translate-y-1/2 pointer-events-none absolute top-1/2 right-4 text-muted-foreground">
                %
              </span>
            </div>
          </div>
        </div>
        {!thresholdsOrdered && (
          <p className="text-destructive text-sm">
            Thresholds must be in ascending order: SEV2 &lt; SEV1 &lt; SEV0.
          </p>
        )}
      </Details>
    </div>
  );
}
