// The copy around each walkthrough. Intro, outro and styling are shared, so
// every video opens and closes the same way; only these words change.
export type Tutorial = {
  id: string;
  title: string;
  subtitle: string;
  outroTitle: string;
  outroSubtitle: string;
};

export const tutorials: Tutorial[] = [
  {
    id: "create-status-page",
    title: "Launch a status page",
    subtitle: "One place for your customers to check what is up.",
    outroTitle: "Your status page is live.",
    outroSubtitle:
      "Next: connect monitors, add your domain, and invite subscribers.",
  },
  {
    id: "create-monitor",
    title: "Create your first monitor",
    subtitle: "From zero to uptime monitoring in under a minute.",
    outroTitle: "You're monitoring.",
    outroSubtitle: "Next: wire up notifications and publish a status page.",
  },
  {
    id: "connect-monitors",
    title: "Show your monitors",
    subtitle: "Turn uptime checks into a page your users can read.",
    outroTitle: "Your page shows live status.",
    outroSubtitle: "Next: post a status report when something breaks.",
  },
  {
    id: "post-status-report",
    title: "Post a status report",
    subtitle: "Keep customers in the loop, from first alert to fix.",
    outroTitle: "Everyone knows what happened.",
    outroSubtitle: "Next: schedule maintenance before your next big change.",
  },
  {
    id: "schedule-maintenance",
    title: "Schedule maintenance",
    subtitle: "Warn customers before planned downtime, not after.",
    outroTitle: "Your users are warned.",
    outroSubtitle: "Next: set up alerts so you hear about issues first.",
  },
  {
    id: "set-up-alerts",
    title: "Get alerted",
    subtitle: "Hear about downtime before your customers do.",
    outroTitle: "You'll be the first to know.",
    outroSubtitle: "Next: add Slack, PagerDuty or a webhook as well.",
  },
];
