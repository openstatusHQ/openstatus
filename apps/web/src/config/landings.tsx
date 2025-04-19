import type { ValidIcon } from "@/components/icons";
import {
  BookingBanner,
  FeatureAPIMonitoring,
  FeatureCLI,
  FeatureCharts,
  FeatureCustomDomain,
  FeatureGitHubAction,
  FeatureMaintenance,
  FeatureNotifications,
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
  image: {
    srcLight: string;
    srcDark: string;
    caption: string;
  };
  icon: ValidIcon;
  blocks: React.ReactNode[];
};

export const landingsConfig = {
  "uptime-monitoring": {
    icon: "activity",
    title: "Uptime Monitoring",
    description:
      "Monitor your uptime and get notified when your services are down.",
    image: {
      srcLight: "/assets/screenshots/uptime-light.png",
      srcDark: "/assets/screenshots/uptime-dark.png",
      caption:
        "Monitor page with uptime, percentiles, and regional response time chart.",
    },
    blocks: [
      <SpeedBanner key="speed-banner" />,
      <FeatureTimingAssertions key="feature-timing-assertions" />,
      <FeatureNotifications key="feature-notifications" />,
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
    image: {
      srcLight: "/assets/screenshots/status-page-light.png",
      srcDark: "/assets/screenshots/status-page-dark.png",
      caption: "Status page with operational systems.",
    },
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
    description: "Monitor your API and website globally.",
    image: {
      srcLight: "/assets/screenshots/response-log-light.png",
      srcDark: "/assets/screenshots/response-log-dark.png",
      caption: "Synthetic monitoring with regional response logs.",
    },
    blocks: [
      <SpeedBanner key="speed-banner" />,
      <FeatureRegions key="feature-regions" />,
      <FeatureGitHubAction key="feature-github-action" />,
      <FeatureCLI key="feature-cli" />,
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
} satisfies Record<string, Landing>;
