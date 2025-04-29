import type { ValidIcon } from "@/components/icons";
import { EnterpriseBanner } from "@/components/marketing/banner/enterprise-banner";
import {
  BookingBanner,
  FeatureAPIMonitoring,
  FeatureCLI,
  FeatureCharts,
  FeatureCustomDomain,
  FeatureGitHubAction,
  FeatureMaintenance,
  FeatureNotifications,
  FeatureOpenTelemetry,
  FeatureOperationalBanner,
  FeaturePasswordProtection,
  FeatureRaycastIntegration,
  FeatureRegions,
  FeatureResponseDetails,
  FeatureStatusPageTracker,
  FeatureStatusPageTrackerToggle,
  FeatureStatusUpdates,
  FeatureSubscriptions,
  FeatureTerraformProvider,
  FeatureTimingAssertions,
  SpeedBanner,
} from "@/components/marketing/feature";

type Landing = {
  title: string;
  description: string;
  icon: ValidIcon;
  blocks: React.ReactNode[];
};

export const landingsConfig = {
  "uptime-monitoring": {
    icon: "activity",
    title: "Uptime Monitoring",
    description:
      "Monitor your uptime and get notified when your services are down.",
    blocks: [
      <FeatureNotifications key="feature-notifications" />,
      <SpeedBanner key="speed-banner" />,
      <FeatureTimingAssertions key="feature-timing-assertions" />,
      <FeatureStatusPageTracker key="feature-status-page-tracker" />,
      <FeatureCharts key="feature-charts" />,
      <FeatureRaycastIntegration key="feature-raycast-integration" />,
      <BookingBanner key="booking-banner" />,
    ],
  },
  "status-page": {
    icon: "panel-top",
    title: "Status Page",
    description: "Create a status page to inform your users about the uptime.",
    blocks: [
      <FeatureCustomDomain key="feature-custom-domain" />,
      <FeatureStatusPageTrackerToggle key="feature-status-page-tracker" />,
      <FeatureSubscriptions key="feature-subscriptions" />,
      <FeatureStatusUpdates key="feature-status-updates" />,
      <FeaturePasswordProtection key="feature-password-protection" />,
      <FeatureOperationalBanner key="feature-operational-banner" />,
      <FeatureMaintenance key="feature-maintenance" />,
      <FeatureRaycastIntegration
        key="feature-raycast-integration"
        position="right"
      />,
      <BookingBanner key="booking-banner" />,
    ],
  },
  "synthetic-monitoring": {
    icon: "network",
    title: "Synthetic Monitoring",
    description: "Proactively monitor your api and website globally.",
    blocks: [
      <FeatureRegions key="feature-regions" />,
      <SpeedBanner key="speed-banner" />,
      <FeatureTimingAssertions key="feature-timing-assertions" />,
      <FeatureAPIMonitoring key="feature-api-monitoring" />,
      <FeatureResponseDetails
        key="feature-response-details"
        position="right"
      />,
      <FeatureTerraformProvider key="feature-terraform-provider" />,
      <BookingBanner key="booking-banner" />,
    ],
  },
  "ci-cd": {
    icon: "terminal",
    title: "CI/CD Testing",
    description:
      "Run your synthetic checks in your CI/CD pipeline and export metrics to your observability stack.",
    blocks: [
      <FeatureGitHubAction key="feature-github-action" />,
      <EnterpriseBanner key="enterprise-banner" />,
      <FeatureAPIMonitoring key="feature-api-monitoring" />,
      <FeatureCLI key="feature-cli" />,
      <FeatureTerraformProvider key="feature-terraform-provider" />,
      <FeatureOpenTelemetry key="feature-open-telemetry" />,
      <BookingBanner key="booking-banner" />,
    ],
  },
} satisfies Record<string, Landing>;
