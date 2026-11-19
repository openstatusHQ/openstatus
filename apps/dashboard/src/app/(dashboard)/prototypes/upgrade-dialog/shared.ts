import type { WorkspacePlan } from "@openstatus/db/src/schema";
import { allPlans } from "@openstatus/db/src/schema/plan/config";
import type {
  Addons,
  BillingInterval,
  Limits,
} from "@openstatus/db/src/schema/plan/schema";
import {
  getAddonPackSize,
  getAddonPriceConfig,
  getPlansForLimit,
  getPriceConfig,
} from "@openstatus/db/src/schema/plan/utils";
import { toast } from "sonner";

import { config as featureGroups } from "@/data/plans";

// The prototype always plays a Hobby workspace that has used up the limit.
export const CURRENT_PLAN: WorkspacePlan = "free";
export const PAID_PLANS: WorkspacePlan[] = ["starter", "team", "scale"];

export type LimitKey = keyof Limits;

export type VariantProps = {
  limit: LimitKey | null;
  currency: string;
  onClose: () => void;
};

export const TRIGGERS: {
  value: string;
  label: string;
  limit: LimitKey | null;
}[] = [
  { value: "status-pages", label: "Create Status Page", limit: "status-pages" },
  { value: "monitors", label: "Create Monitor", limit: "monitors" },
  { value: "custom-domain", label: "Custom domain", limit: "custom-domain" },
  { value: "audit-log", label: "Audit log", limit: "audit-log" },
  { value: "none", label: "Sidebar upgrade banner", limit: null },
];

const UNITS: Partial<Record<LimitKey, [string, string]>> = {
  monitors: ["monitor", "monitors"],
  "status-pages": ["status page", "status pages"],
  "page-components": ["page component", "page components"],
  "notification-channels": ["notification channel", "notification channels"],
  members: ["team member", "team members"],
  "max-regions": ["region per monitor", "regions per monitor"],
};

export const featureLabel = Object.fromEntries(
  Object.values(featureGroups).flatMap(({ features }) =>
    features.map((feature) => [feature.value, feature.label]),
  ),
) as Partial<Record<LimitKey, string>>;

export function groupOf(limit: LimitKey) {
  return Object.entries(featureGroups).find(([, group]) =>
    group.features.some((feature) => feature.value === limit),
  )?.[0];
}

export function unit(limit: LimitKey, count: number) {
  const names = UNITS[limit];
  if (!names) return featureLabel[limit] ?? limit;
  return count === 1 ? names[0] : names[1];
}

/** The plan's value for a limit, reduced to what a cell shows. */
export function limitValue(plan: WorkspacePlan, limit: LimitKey) {
  const value = allPlans[plan].limits[limit];
  if (limit === "regions" && Array.isArray(value)) return value.length;
  if (Array.isArray(value)) return value[0];
  return value as number | boolean | string | undefined;
}

export function phrase(plan: WorkspacePlan, limit: LimitKey) {
  const value = limitValue(plan, limit);
  if (limit === "periodicity") return `Checks every ${value}`;
  if (limit === "data-retention") return `${value} data retention`;
  if (limit === "members") return `${value} team members`;
  if (typeof value === "number") return `${value} ${unit(limit, value)}`;
  return featureLabel[limit] ?? limit;
}

export function formatPrice(price: {
  value: number;
  locale: string;
  currency: string;
}) {
  return new Intl.NumberFormat(price.locale, {
    style: "currency",
    currency: price.currency,
    maximumFractionDigits: 0,
  }).format(price.value);
}

export function planPrice(
  plan: WorkspacePlan,
  currency: string,
  interval: BillingInterval,
) {
  return formatPrice(getPriceConfig(plan, currency, interval));
}

export function addonFor(
  plan: WorkspacePlan,
  limit: LimitKey,
  currency: string,
  interval: BillingInterval,
) {
  if (!(limit in allPlans[plan].addons)) return null;
  const addon = limit as keyof Addons;
  const price = getAddonPriceConfig(plan, addon, currency, interval);
  if (!price) return null;
  const packSize = getAddonPackSize(addon);
  const period = interval === "yearly" ? "yr" : "mo";
  const isQuantity = typeof allPlans[plan].limits[limit] === "number";
  return {
    price: formatPrice(price),
    per: !isQuantity
      ? `/${period}`
      : packSize > 1
        ? `/${period} per ${packSize}`
        : `/${period} each`,
  };
}

/** Plans whose base limits already lift the wall, cheapest first. */
export function plansLifting(limit: LimitKey | null) {
  if (!limit) return PAID_PLANS;
  return getPlansForLimit(CURRENT_PLAN, limit);
}

export function recommendedPlan(limit: LimitKey | null): WorkspacePlan {
  return plansLifting(limit)[0] ?? "starter";
}

const HIGHLIGHT_ORDER: LimitKey[] = [
  "monitors",
  "periodicity",
  "max-regions",
  "data-retention",
  "status-pages",
  "page-components",
  "custom-domain",
  "status-subscribers",
  "notification-channels",
  "members",
  "private-locations",
  "audit-log",
];

/** What a plan adds over Hobby, without the limit that opened the dialog. */
export function highlights(
  plan: WorkspacePlan,
  exclude: LimitKey | null,
  count: number,
) {
  return HIGHLIGHT_ORDER.filter((limit) => {
    if (limit === exclude) return false;
    const next = limitValue(plan, limit);
    return next !== false && next !== limitValue(CURRENT_PLAN, limit);
  })
    .slice(0, count)
    .map((limit) => ({ limit, text: phrase(plan, limit) }));
}

export function wallCopy(limit: LimitKey | null) {
  if (!limit) {
    return {
      title: "Upgrade workspace",
      description:
        "More monitors, faster checks, custom domains and everything your team needs to run status pages in production.",
    };
  }
  const current = limitValue(CURRENT_PLAN, limit);
  if (typeof current === "number") {
    return {
      title: `You've used ${current} of ${current} ${unit(limit, current)}`,
      description: `Hobby includes ${current} ${unit(limit, current)}. Pick a plan to add more.`,
    };
  }
  return {
    title: `${featureLabel[limit] ?? limit} is a paid feature`,
    description: `Hobby does not include ${(featureLabel[limit] ?? limit).toLowerCase()}. Pick a plan that does.`,
  };
}

export function fakeCheckout(
  plan: WorkspacePlan,
  interval: BillingInterval,
  trial = false,
) {
  toast.success(
    trial
      ? `Prototype: would start the ${allPlans[plan].title} trial`
      : `Prototype: would open ${interval} checkout for ${allPlans[plan].title}`,
  );
}
