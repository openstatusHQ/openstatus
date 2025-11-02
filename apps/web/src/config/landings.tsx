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
  FeaturePrivateLocationsDockerImage,
  FeaturePrivateLocationsDockerInstall,
  FeatureRaycastIntegration,
  FeatureRegions,
  FeatureResponseDetails,
  FeatureStatusPageThemes,
  FeatureStatusPageTracker,
  FeatureStatusPageTrackerToggle,
  FeatureStatusUpdates,
  FeatureSubscriptions,
  FeatureTerraformProvider,
  FeatureTimingAssertions,
  FeatureYAML,
  SpeedBanner,
} from "@/components/marketing/feature";
import { MonitoringCard } from "@/components/marketing/monitor/card";

type Landing = {
  title: string;
  hero: string;
  description: string;
  icon: ValidIcon;
  blocks: React.ReactNode[];
};

export const landingsConfig = {
  "uptime-monitoring": {
    icon: "activity",
    title: "Uptime Monitoring",
    hero: "Detect downtime before your users do",
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
    hero: "Turn transparency into trust with a dedicated status page",
    description:
      "Keep users informed during downtime, so you can focus on the fix.",
    blocks: [
      <FeatureCustomDomain key="feature-custom-domain" />,
      <FeatureStatusPageTrackerToggle key="feature-status-page-tracker" />,
      <FeatureStatusPageThemes key="feature-status-page-themes" />,
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
  "api-monitoring": {
    icon: "chevron-left-right-ellipsis",
    title: "API Monitoring",
    hero: "API Reliability: We've Got You Covered.",
    description:
      "Don't let slow APIs frustrate your users. Ensure smooth experiences with global monitoring.",
    blocks: [
      <MonitoringCard key="monitoring-card" />,
      <SpeedBanner key="speed-banner" />,
      <FeatureYAML key="feature-yaml-file" position="top" />,
      <EnterpriseBanner key="enterprise-banner" />,
      <FeatureAPIMonitoring key="feature-api-monitoring" />,
      <FeatureOpenTelemetry key="feature-open-telemetry" />,
      <BookingBanner key="booking-banner" />,
    ],
  },
  "monitoring-as-code": {
    icon: "terminal",
    title: "Monitoring as Code",
    hero: "Get rid of ClickOps for your uptime monitoring configuration",
    description: "Define your Monitors with YAML. Control Them with Our CLI.",
    blocks: [
      <FeatureCLI key="feature-cli" />,
      <FeatureYAML key="feature-yaml-file" position="top" />,
      <FeatureGitHubAction key="feature-github-action" />,
      <EnterpriseBanner key="enterprise-banner" />,
      <FeatureAPIMonitoring key="feature-api-monitoring" />,
      <FeatureTerraformProvider key="feature-terraform-provider" />,
      <FeatureOpenTelemetry key="feature-open-telemetry" />,
      <BookingBanner key="booking-banner" />,
    ],
  },
  "synthetic-monitoring": {
    icon: "network",
    title: "Synthetic Monitoring",
    hero: "Stop Guessing. Start Knowing. Monitor Your API's Performance Globally.",
    description:
      "Proactively identify and resolve application issues across the globe.",
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
  "private-locations": {
    icon: "globe",
    title: "Private Locations",
    hero: "Monitor from anywhere. Literally anywhere.",
    description: "Monitor your services from your own infrastructure.",
    blocks: [
      <SpeedBanner key="speed-banner" />,
      <FeaturePrivateLocationsDockerImage key="feature-private-locations-docker-image" />,
      <FeaturePrivateLocationsDockerInstall key="feature-private-locations-docker-install" />,
      <FeatureCharts
        key="feature-charts"
        title="Private Locations."
        subTitle="Latency, availability and performance of your internal services. Always be close to your users."
      />,
      <BookingBanner key="enterprise-banner" />,
    ],
  },
} satisfies Record<string, Landing>;
