type Config = Record<
  string,
  {
    name: string;
    logo: string;
    description: string;
    features: Feature[];
    uptime?: Feature[];
    monitoring?: Feature[];
  }
>;

type Feature = {
  label: string;
  description: string;
  openstatus: string | boolean | number | undefined;
  alternative: string | boolean | number | undefined;
  url?: string;
};

export const alternativesConfig = {
  betterstack: {
    name: "BetterStack",
    logo: "/assets/alternatives/betterstack.png",
    description: "Bootstrap directly to the founder.",
    features: [
      opensource(),
      bootstrap(),
      global(),
      incident(),
      otelexport(),
      githubaction(),
      cli(),
      privatepage("additional $42/month"),
      pagesubscribers("additional $40/month per 1000 subscribers"),
    ],
  },
  "uptime-robot": {
    name: "UptimeRobot",
    description: "Monitor your endpoints globally.",
    logo: "/assets/alternatives/uptime-robot.png",
    features: [
      opensource(),
      bootstrap(),
      global(),
      githubaction(),
      teammembers("additional 19$/seat"),
    ],
  },
  "uptime-kuma": {
    name: "Uptime Kuma",
    description: "Monitor your endpoints globally.",
    logo: "/assets/alternatives/uptime-kuma.png",
    features: [opensource(), global(), selfhost(), managed(), githubaction()],
  },
  checkly: {
    name: "Checkly",
    description: "Open-Source multi-region monitoring.",
    logo: "/assets/alternatives/checkly.png",
    features: [global(true), statuspage(undefined), opensource(), bootstrap()],
  },
} satisfies Config;

/** HELPER FUNCTIONS */

function opensource(alternative = false): Feature {
  return {
    label: "Open Source",
    description: "Self-hosted or cloud-based.",
    openstatus: true,
    alternative,
    url: "https://github.com/openstatusHQ/openstatus",
  };
}

function bootstrap(alternative = false): Feature {
  return {
    label: "Bootstrap",
    description: "Talk directly to the founder.",
    openstatus: true,
    alternative,
    url: "https://cal.com/team/openstatus/30min",
  };
}

function global(alternative = false): Feature {
  return {
    label: "Global (35 regions)",
    description: "Monitor your endpoints globally.",
    openstatus: true,
    alternative,
  };
}

function incident(alternative = true): Feature {
  return {
    label: "Incident Escalation",
    description: "Escalate incidents within your team.",
    openstatus: false,
    alternative,
  };
}

function otelexport(alternative = false): Feature {
  return {
    label: "OTel Export",
    description: "Export synthetic checks to OTel",
    openstatus: true,
    alternative,
  };
}

function githubaction(alternative = false): Feature {
  return {
    label: "GitHub Action",
    description: "Trigger your monitor via CI/CD",
    openstatus: true,
    alternative,
    url: "https://github.com/marketplace/actions/openstatus-synthetics-ci",
  };
}

function cli(alternative = false): Feature {
  return {
    label: "CLI to trigger checks",
    description: "Never leave your terminal.",
    openstatus: true,
    alternative,
  };
}

function statuspage(alternative: boolean | undefined): Feature {
  return {
    label: "Status Page",
    description: "Share your uptime with your customers.",
    openstatus: true,
    alternative,
  };
}

function privatepage(alternative: string): Feature {
  return {
    label: "Private status page",
    description: "Share your status page with your team.",
    openstatus: "included in team plan",
    alternative,
  };
}

function pagesubscribers(alternative: string): Feature {
  return {
    label: "Status page subscribers",
    description: "Keep your customers in the loop.",
    openstatus: "Unlimited",
    alternative,
  };
}

function teammembers(alternative: string): Feature {
  return {
    label: "Team members",
    description: "Invite your team to the dashboard.",
    openstatus: "Unlimited",
    alternative,
  };
}

function selfhost(alternative = "easy"): Feature {
  return {
    label: "Self hostable",
    description: "Make it yours and deploy it.",
    openstatus: "hard",
    alternative,
  };
}

function managed(alternative = false): Feature {
  return {
    label: "Managed",
    description: "Don't worry about bug fixes.",
    openstatus: true,
    alternative,
  };
}
