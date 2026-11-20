/** Hosted openstatus serves `{slug}.openstatus.dev`. */
export const DEFAULT_STATUS_PAGE_BASE_DOMAIN = "openstatus.dev";

export type DeploymentConfig = {
  /** Pages without a custom domain live at `{slug}.{statusPageBaseDomain}`. */
  statusPageBaseDomain: string;
  /** No Vercel: custom domains are routed and TLS-terminated by the operator. */
  isSelfHosted: boolean;
};

export const DEFAULT_DEPLOYMENT_CONFIG: DeploymentConfig = {
  statusPageBaseDomain: DEFAULT_STATUS_PAGE_BASE_DOMAIN,
  isSelfHosted: false,
};

/**
 * Normalizes a configured base domain to a bare lowercase hostname: drops a
 * scheme, path, port and surrounding dots. An empty value means the default.
 */
export function normalizeBaseDomain(value?: string | null): string {
  const normalized = (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "")
    .replace(/^\.+|\.+$/g, "");
  return normalized || DEFAULT_STATUS_PAGE_BASE_DOMAIN;
}

/**
 * Server only. Images are prebuilt, so both values are runtime envs
 * (`STATUS_PAGE_BASE_DOMAIN`, `SELF_HOST`) read on the server and handed to
 * client components through `DeploymentConfigProvider`.
 */
export function getDeploymentConfig(
  env: Record<string, string | undefined> = process.env,
): DeploymentConfig {
  return {
    statusPageBaseDomain: normalizeBaseDomain(env.STATUS_PAGE_BASE_DOMAIN),
    isSelfHosted: env.SELF_HOST === "true",
  };
}

/** `{slug}.{baseDomain}`, without scheme. */
export function getStatusPageHost(
  slug: string,
  baseDomain: string = DEFAULT_STATUS_PAGE_BASE_DOMAIN,
): string {
  return `${slug}.${baseDomain}`;
}

/** The page's public URL: its custom domain, else `https://{slug}.{baseDomain}`. */
export function getStatusPageUrl(
  page: { slug: string; customDomain?: string | null },
  baseDomain: string = DEFAULT_STATUS_PAGE_BASE_DOMAIN,
): string {
  return `https://${page.customDomain || getStatusPageHost(page.slug, baseDomain)}`;
}
