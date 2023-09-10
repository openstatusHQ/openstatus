// CREDITS: https://github.com/valeriangalliat/vercel-custom-log-drain/blob/43043c095475c9fac279e5fec8976497ee1ea9b6/clients/vercel.ts

async function fetchOk(
  url: string,
  init?: RequestInit | undefined,
): Promise<Response> {
  const res = await fetch(url, init);

  if (!res.ok) {
    const contentType = res.headers.get("content-type");
    let body: string | object | null;

    try {
      const isJson = contentType && contentType.includes("json");
      body = await (isJson ? res.json() : res.text());
    } catch (err) {
      body = null;
    }

    console.log({ body });

    throw Object.assign(new Error(`Failed to fetch: ${url}`), {
      res,
      body,
    });
  }

  return res;
}

const base = "https://api.vercel.com";

export async function getToken(code: string): Promise<string> {
  const url = `${base}/v2/oauth/access_token`;

  const res = await fetchOk(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: process.env.VERCEL_CLIENT_ID || "",
      client_secret: process.env.VERCEL_CLIENT_SECRET || "",
      code,
      redirect_uri: process.env.VERCEL_REDIRECT_URI || "",
    }),
  });

  const json = await res.json();

  return json.access_token;
}

// Type from <https://vercel.com/docs/log-drains>
export type LogDrain = {
  /** The oauth2 client application id that created this log drain */
  clientId: string;
  /** The client configuration this log drain was created with */
  configurationId: string;
  /** A timestamp that tells you when the log drain was created */
  createdAt: number;
  /** The unique identifier of the log drain. Always prefixed with `ld_` */
  id: string;
  /** The type of log format */
  deliveryFormat: "json" | "ndjson" | "syslog";
  /** The name of the log drain */
  name: string;
  /** The identifier of the team or user whose events will trigger the log drain */
  ownerId: string;
  /** The identifier of the project this log drain is associated with */
  projectId?: string | null;
  /** The URL to call when logs are generated */
  url: string;
  /** TODO: add correct description and check if correct */
  headers?: Record<string, string>;
  /** The sources from which logs are currently being delivered to this log drain */
  sources?: (
    | "static"
    | "lambda"
    | "build"
    | "edge"
    | "external"
    | "deployment"
  )[]; // REMINDER: creating a log drain with "deployment" source won't work
};

export type ProjectResponse = {
  accountId: string;
  analytics?: {
    id: string;
    canceledAt: number | null;
    disabledAt: number;
    enabledAt: number;
    paidAt?: number;
    sampleRatePercent?: number | null;
    spendLimitInDollars?: number | null;
  };
  autoExposeSystemEnvs?: boolean;
  autoAssignCustomDomains?: boolean;
  autoAssignCustomDomainsUpdatedBy?: string;
  buildCommand?: string | null;
  commandForIgnoringBuildStep?: string | null;
  connectConfigurationId?: string | null;
  connectBuildsEnabled?: boolean;
  createdAt?: number;
  customerSupportCodeVisibility?: boolean;
  crons?: {
    /** The time the feature was enabled for this project. Note: It enables automatically with the first Deployment that outputs cronjobs. */
    enabledAt: number;
    /** The time the feature was disabled for this project. */
    disabledAt: number | null;
    updatedAt: number;
    /** The ID of the Deployment from which the definitions originated. */
    deploymentId: string | null;
    definitions: {
      /** The hostname that should be used. */
      host: string;
      /** The path that should be called for the cronjob. */
      path: string;
      /** The cron expression. */
      schedule: string;
    }[];
  };
  dataCache?: {
    userDisabled: boolean;
    storageSizeBytes?: number | null;
    unlimited?: boolean;
  };
  devCommand?: string | null;
  directoryListing: boolean;
  installCommand?: string | null;
  env?: {
    target?:
      | ("production" | "preview" | "development" | "preview" | "development")[]
      | ("production" | "preview" | "development" | "preview" | "development");
    type: "system" | "secret" | "encrypted" | "plain" | "sensitive";
    id?: string;
    key: string;
    value: string;
    configurationId?: string | null;
    createdAt?: number;
    updatedAt?: number;
    createdBy?: string | null;
    updatedBy?: string | null;
    gitBranch?: string;
    edgeConfigId?: string | null;
    edgeConfigTokenId?: string | null;
    contentHint?:
      | (
          | {
              type: "redis-url";
              storeId: string;
            }
          | {
              type: "redis-rest-api-url";
              storeId: string;
            }
          | {
              type: "redis-rest-api-token";
              storeId: string;
            }
          | {
              type: "redis-rest-api-read-only-token";
              storeId: string;
            }
          | {
              type: "blob-read-write-token";
              storeId: string;
            }
          | {
              type: "postgres-url";
              storeId: string;
            }
          | {
              type: "postgres-url-non-pooling";
              storeId: string;
            }
          | {
              type: "postgres-prisma-url";
              storeId: string;
            }
          | {
              type: "postgres-user";
              storeId: string;
            }
          | {
              type: "postgres-host";
              storeId: string;
            }
          | {
              type: "postgres-password";
              storeId: string;
            }
          | {
              type: "postgres-database";
              storeId: string;
            }
        )
      | null;
    /** Whether `value` is decrypted. */
    decrypted?: boolean;
  }[];
  framework?:
    | (
        | "blitzjs"
        | "nextjs"
        | "gatsby"
        | "remix"
        | "astro"
        | "hexo"
        | "eleventy"
        | "docusaurus-2"
        | "docusaurus"
        | "preact"
        | "solidstart"
        | "dojo"
        | "ember"
        | "vue"
        | "scully"
        | "ionic-angular"
        | "angular"
        | "polymer"
        | "svelte"
        | "sveltekit"
        | "sveltekit-1"
        | "ionic-react"
        | "create-react-app"
        | "gridsome"
        | "umijs"
        | "sapper"
        | "saber"
        | "stencil"
        | "nuxtjs"
        | "redwoodjs"
        | "hugo"
        | "jekyll"
        | "brunch"
        | "middleman"
        | "zola"
        | "hydrogen"
        | "vite"
        | "vitepress"
        | "vuepress"
        | "parcel"
        | "sanity"
        | "storybook"
      )
    | null;
  gitForkProtection?: boolean;
  gitLFS?: boolean;
  id: string;
  latestDeployments?: {
    alias?: string[];
    aliasAssigned?: (number | boolean) | null;
    aliasError?: {
      code: string;
      message: string;
    } | null;
    aliasFinal?: string | null;
    automaticAliases?: string[];
    builds?: {
      use: string;
      src?: string;
      dest?: string;
    }[];
    connectBuildsEnabled?: boolean;
    connectConfigurationId?: string;
    createdAt: number;
    createdIn: string;
    creator: {
      email: string;
      githubLogin?: string;
      gitlabLogin?: string;
      uid: string;
      username: string;
    } | null;
    deploymentHostname: string;
    name: string;
    forced?: boolean;
    id: string;
    meta?: { [key: string]: string };
    monorepoManager?: string | null;
    plan: "pro" | "enterprise" | "hobby" | "oss";
    private: boolean;
    readyState:
      | "BUILDING"
      | "ERROR"
      | "INITIALIZING"
      | "QUEUED"
      | "READY"
      | "CANCELED";
    readySubstate?: "STAGED" | "PROMOTED";
    requestedAt?: number;
    target?: string | null;
    teamId?: string | null;
    type: "LAMBDAS";
    url: string;
    userId: string;
    withCache?: boolean;
    checksConclusion?: "succeeded" | "failed" | "skipped" | "canceled";
    checksState?: "registered" | "running" | "completed";
    readyAt?: number;
    buildingAt?: number;
    /** Whether or not preview comments are enabled for the deployment */
    previewCommentsEnabled?: boolean;
  }[];
  link?:
    | {
        org?: string;
        repo?: string;
        repoId?: number;
        type?: "github";
        createdAt?: number;
        deployHooks: {
          createdAt?: number;
          id: string;
          name: string;
          ref: string;
          url: string;
        }[];
        gitCredentialId?: string;
        updatedAt?: number;
        sourceless?: boolean;
        productionBranch?: string;
      }
    | {
        projectId?: string;
        projectName?: string;
        projectNameWithNamespace?: string;
        projectNamespace?: string;
        projectUrl?: string;
        type?: "gitlab";
        createdAt?: number;
        deployHooks: {
          createdAt?: number;
          id: string;
          name: string;
          ref: string;
          url: string;
        }[];
        gitCredentialId?: string;
        updatedAt?: number;
        sourceless?: boolean;
        productionBranch?: string;
      }
    | {
        name?: string;
        slug?: string;
        owner?: string;
        type?: "bitbucket";
        uuid?: string;
        workspaceUuid?: string;
        createdAt?: number;
        deployHooks: {
          createdAt?: number;
          id: string;
          name: string;
          ref: string;
          url: string;
        }[];
        gitCredentialId?: string;
        updatedAt?: number;
        sourceless?: boolean;
        productionBranch?: string;
      };
  name: string;
  nodeVersion: "18.x" | "16.x" | "14.x" | "12.x" | "10.x";
  outputDirectory?: string | null;
  passwordProtection?: { [key: string]: unknown } | null;
  productionDeploymentsFastLane?: boolean;
  publicSource?: boolean | null;
  rootDirectory?: string | null;
  serverlessFunctionRegion?: string | null;
  skipGitConnectDuringLink?: boolean;
  sourceFilesOutsideRootDirectory?: boolean;
  ssoProtection?: {
    deploymentType: "all" | "preview" | "prod_deployment_urls_and_all_previews";
  } | null;
  targets?: {
    [key: string]: {
      alias?: string[];
      aliasAssigned?: (number | boolean) | null;
      aliasError?: {
        code: string;
        message: string;
      } | null;
      aliasFinal?: string | null;
      automaticAliases?: string[];
      builds?: {
        use: string;
        src?: string;
        dest?: string;
      }[];
      connectBuildsEnabled?: boolean;
      connectConfigurationId?: string;
      createdAt: number;
      createdIn: string;
      creator: {
        email: string;
        githubLogin?: string;
        gitlabLogin?: string;
        uid: string;
        username: string;
      } | null;
      deploymentHostname: string;
      name: string;
      forced?: boolean;
      id: string;
      meta?: { [key: string]: string };
      monorepoManager?: string | null;
      plan: "pro" | "enterprise" | "hobby" | "oss";
      private: boolean;
      readyState:
        | "BUILDING"
        | "ERROR"
        | "INITIALIZING"
        | "QUEUED"
        | "READY"
        | "CANCELED";
      readySubstate?: "STAGED" | "PROMOTED";
      requestedAt?: number;
      target?: string | null;
      teamId?: string | null;
      type: "LAMBDAS";
      url: string;
      userId: string;
      withCache?: boolean;
      checksConclusion?: "succeeded" | "failed" | "skipped" | "canceled";
      checksState?: "registered" | "running" | "completed";
      readyAt?: number;
      buildingAt?: number;
      /** Whether or not preview comments are enabled for the deployment */
      previewCommentsEnabled?: boolean;
    } | null;
  };
  transferCompletedAt?: number;
  transferStartedAt?: number;
  transferToAccountId?: string;
  transferredFromAccountId?: string;
  updatedAt?: number;
  live?: boolean;
  enablePreviewFeedback?: boolean | null;
  permissions?: {};
  lastRollbackTarget?: { [key: string]: unknown } | null;
  lastAliasRequest?: {
    fromDeploymentId: string;
    toDeploymentId: string;
    jobStatus: "succeeded" | "failed" | "skipped" | "pending" | "in-progress";
    requestedAt: number;
    type: "promote" | "rollback";
  } | null;
  hasFloatingAliases?: boolean;
  protectionBypass?: {
    [key: string]:
      | {
          createdAt: number;
          createdBy: string;
          scope: "shareable-link" | "automation-bypass";
        }
      | {
          createdAt: number;
          lastUpdatedAt: number;
          lastUpdatedBy: string;
          access: "requested" | "granted";
          scope: "user";
        };
  };
  hasActiveBranches?: boolean;
  trustedIps?:
    | (
        | {
            deploymentType:
              | "all"
              | "preview"
              | "prod_deployment_urls_and_all_previews"
              | "production";
            addresses: {
              value: string;
              note?: string;
            }[];
            protectionMode: "additional" | "exclusive";
          }
        | {
            deploymentType:
              | "all"
              | "preview"
              | "prod_deployment_urls_and_all_previews"
              | "production";
          }
      )
    | null;
  gitComments?: {
    /** Whether the Vercel bot should comment on PRs */
    onPullRequest: boolean;
    /** Whether the Vercel bot should comment on commits */
    onCommit: boolean;
  };
};

function getQuery(teamId?: string) {
  return teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";
}

export async function getLogDrains(
  token: string,
  teamId?: string,
): Promise<LogDrain[]> {
  const url = `${base}/v2/integrations/log-drains${getQuery(teamId)}`;

  const res = await fetchOk(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return await res.json();
}

export async function getProject(token: string, teamId?: string) {
  const url = `${base}/v9/projects${getQuery(teamId)}`;

  const res = await fetchOk(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return await res.json();
}

export async function createLogDrain(
  token: string,
  logDrain: LogDrain,
  teamId?: string,
): Promise<LogDrain> {
  const url = `${base}/v2/integrations/log-drains${getQuery(teamId)}`;

  console.log({ token, logDrain, teamId });

  const res = await fetchOk(url, {
    method: "post",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(logDrain),
  });

  return await res.json();
}

export async function deleteLogDrain(
  token: string,
  id: string,
  teamId?: string,
): Promise<void> {
  const url = `${base}/v1/integrations/log-drains/${encodeURIComponent(
    id,
  )}${getQuery(teamId)}`;

  await fetchOk(url, {
    method: "delete",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}
