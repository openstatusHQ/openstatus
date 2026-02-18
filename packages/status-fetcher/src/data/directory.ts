import type { StatusPageEntry } from "../types";
import { statusPageEntrySchema } from "../types";

const rawDirectory: StatusPageEntry[] = [
  {
    id: "github",
    name: "GitHub",
    url: "https://github.com",
    status_page_url: "https://www.githubstatus.com",
    provider: "atlassian-statuspage",
    industry: ["development-tools"],
    description: "The world's leading software development platform",
    api_config: {
      type: "atlassian",
    },
  },
  {
    id: "vercel",
    name: "Vercel",
    url: "https://vercel.com",
    status_page_url: "https://www.vercel-status.com",
    provider: "atlassian-statuspage",
    industry: ["cloud-providers", "development-tools"],
    description: "Platform for frontend developers",
    api_config: {
      type: "atlassian",
    },
  },
  {
    id: "slack",
    name: "Slack",
    url: "https://slack.com",
    status_page_url: "https://slack-status.com",
    provider: "custom",
    industry: ["communication"],
    description: "Team collaboration and messaging platform",
    api_config: {
      type: "custom",
      endpoint: "https://slack-status.com/api/v2.0.0/current",
      parser: "slack",
    },
  },
  {
    id: "linear",
    name: "Linear",
    url: "https://linear.app",
    status_page_url: "https://status.linear.app",
    provider: "incidentio",
    industry: ["development-tools", "saas"],
    description: "Issue tracking tool built for modern software teams",
    api_config: {
      type: "incidentio",
    },
  },
  {
    id: "openai",
    name: "OpenAI",
    url: "https://openai.com",
    status_page_url: "https://status.openai.com",
    provider: "atlassian-statuspage",
    industry: ["ai-ml"],
    description: "AI research and deployment company",
    api_config: {
      type: "atlassian",
    },
  },
  {
    id: "stripe",
    name: "Stripe",
    url: "https://stripe.com",
    status_page_url: "https://status.stripe.com",
    provider: "atlassian-statuspage",
    industry: ["fintech"],
    description: "Online payment processing platform",
    api_config: {
      type: "atlassian",
    },
  },
  {
    id: "cloudflare",
    name: "Cloudflare",
    url: "https://cloudflare.com",
    status_page_url: "https://www.cloudflarestatus.com",
    provider: "atlassian-statuspage",
    industry: ["cdn", "security"],
    description: "Web infrastructure and security company",
    api_config: {
      type: "atlassian",
    },
  },
  {
    id: "turso",
    name: "Turso",
    url: "https://turso.tech",
    status_page_url: "https://status.turso.tech",
    provider: "better-uptime",
    industry: ["databases"],
    description: "Turso is a database for the modern web",
    api_config: {
      type: "atlassian",
    },
  },
];

/**
 * Validates all directory entries at module load time
 *
 * This function runs once when the module is imported and ensures all entries
 * conform to the StatusPageEntry schema. If any validation errors are found,
 * it throws immediately with detailed error information.
 *
 * **Validation checks:**
 * - ID is non-empty string
 * - Name is non-empty string
 * - URLs are valid (url, status_page_url, logo_url if present)
 * - Provider is from allowed list
 * - At least one industry category
 * - API config matches expected format
 *
 * @returns The validated directory array
 * @throws {Error} If any entry fails validation, with details about which fields failed
 *
 * @example
 * Error message format:
 * ```
 * Directory validation failed with 2 error(s):
 *   - Entry 0 (github): url: Invalid url
 *   - Entry 3 (stripe): industry: Array must contain at least 1 element(s)
 * ```
 */
function validateDirectory(): StatusPageEntry[] {
  const errors: string[] = [];

  rawDirectory.forEach((entry, index) => {
    const result = statusPageEntrySchema.safeParse(entry);
    if (!result.success) {
      const formattedErrors = result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join(", ");
      errors.push(
        `Entry ${index} (${entry.id || "unknown"}): ${formattedErrors}`,
      );
    }
  });

  if (errors.length > 0) {
    throw new Error(
      `Directory validation failed with ${errors.length} error(s):\n${errors
        .map((e) => `  - ${e}`)
        .join("\n")}`,
    );
  }

  return rawDirectory;
}

export const directory = validateDirectory();
