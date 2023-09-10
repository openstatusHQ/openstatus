import * as z from "zod";

/**
 * If the response of the request returns an HTTP statusCode with a value of -1,
 * that means there was no response returned and the lambda crashed.
 * In the same response, if the value of proxy.statusCode is returned with -1,
 * that means the revalidation occurred in the background.
 */

// https://vercel.com/docs/observability/log-drains-overview/log-drains-reference#json-log-drains
export const logDrainSchema = z.object({
  id: z.string().optional(),
  timestamp: z.number().optional(),
  type: z
    .enum([
      "middleware-invocation",
      "stdout",
      "stderr",
      "edge-function-invocation",
      "fatal",
    ])
    .optional(),
  edgeType: z.enum(["edge-function", "middleware"]).optional(),
  requestId: z.string().optional(),
  statusCode: z.number().optional(),
  message: z.string().optional(),
  projectId: z.string().optional(),
  deploymentId: z.string().optional(),
  buildId: z.string().optional(),
  source: z.enum(["external", "lambda", "edge", "static", "build"]),
  host: z.string().optional(),
  environment: z.string().optional(),
  branch: z.string().optional(),
  destination: z.string().optional(),
  path: z.string().optional(),
  entrypoint: z.string().optional(),
  proxy: z
    .object({
      timestamp: z.number().optional(),
      region: z.string().optional(), // TODO: use regions enum?
      method: z.string().optional(), // TODO: use methods enum?
      vercelCache: z.string().optional(), // TODO: use "HIT" / "MISS" enum?
      statusCode: z.number().optional(),
      path: z.string().optional(),
      host: z.string().optional(),
      scheme: z.string().optional(),
      clientIp: z.string().optional(),
      userAgent: z.array(z.string()).optional(),
    })
    .optional(),
});

export const logDrainSchemaArray = z.array(logDrainSchema);

export const projectSchema = z.object({
  accountId: z.string(),
  analytics: z
    .object({
      id: z.string(),
      canceledAt: z.number().nullable(),
      disabledAt: z.number(),
      enabledAt: z.number(),
      paidAt: z.number().optional(),
      sampleRatePercent: z.number().optional().nullable(),
      spendLimitInDollars: z.number().optional().nullable(),
    })
    .optional(),
  autoExposeSystemEnvs: z.boolean().optional(),
  autoAssignCustomDomains: z.boolean().optional(),
  autoAssignCustomDomainsUpdatedBy: z.string().optional(),
  buildCommand: z.string().optional().nullable(),
  commandForIgnoringBuildStep: z.string().optional().nullable(),
  connectConfigurationId: z.string().optional().nullable(),
  connectBuildsEnabled: z.boolean().optional(),
  createdAt: z.number().optional(),
  customerSupportCodeVisibility: z.boolean().optional(),
  crons: z
    .object({
      enabledAt: z.number(),
      disabledAt: z.number().nullable(),
      updatedAt: z.number(),
      deploymentId: z.string().nullable(),
      definitions: z.array(
        z.object({
          host: z.string(),
          path: z.string(),
          schedule: z.string(),
        }),
      ),
    })
    .optional(),
  dataCache: z
    .object({
      userDisabled: z.boolean(),
      storageSizeBytes: z.number().optional().nullable(),
      unlimited: z.boolean().optional(),
    })
    .optional(),
  devCommand: z.string().optional().nullable(),
  directoryListing: z.boolean(),
  installCommand: z.string().optional().nullable(),
  env: z
    .array(
      z.object({
        target: z
          .union([
            z.array(
              z.union([
                z.literal("production"),
                z.literal("preview"),
                z.literal("development"),
                z.literal("preview"),
                z.literal("development"),
              ]),
            ),
            z.union([
              z.literal("production"),
              z.literal("preview"),
              z.literal("development"),
              z.literal("preview"),
              z.literal("development"),
            ]),
          ])
          .optional(),
        type: z.union([
          z.literal("secret"),
          z.literal("system"),
          z.literal("encrypted"),
          z.literal("plain"),
          z.literal("sensitive"),
        ]),
        id: z.string().optional(),
        key: z.string(),
        value: z.string(),
        configurationId: z.string().optional().nullable(),
        createdAt: z.number().optional(),
        updatedAt: z.number().optional(),
        createdBy: z.string().optional().nullable(),
        updatedBy: z.string().optional().nullable(),
        gitBranch: z.string().optional(),
        edgeConfigId: z.string().optional().nullable(),
        edgeConfigTokenId: z.string().optional().nullable(),
        contentHint: z
          .union([
            z.object({
              type: z.literal("redis-url"),
              storeId: z.string(),
            }),
            z.object({
              type: z.literal("redis-rest-api-url"),
              storeId: z.string(),
            }),
            z.object({
              type: z.literal("redis-rest-api-token"),
              storeId: z.string(),
            }),
            z.object({
              type: z.literal("redis-rest-api-read-only-token"),
              storeId: z.string(),
            }),
            z.object({
              type: z.literal("blob-read-write-token"),
              storeId: z.string(),
            }),
            z.object({
              type: z.literal("postgres-url"),
              storeId: z.string(),
            }),
            z.object({
              type: z.literal("postgres-url-non-pooling"),
              storeId: z.string(),
            }),
            z.object({
              type: z.literal("postgres-prisma-url"),
              storeId: z.string(),
            }),
            z.object({
              type: z.literal("postgres-user"),
              storeId: z.string(),
            }),
            z.object({
              type: z.literal("postgres-host"),
              storeId: z.string(),
            }),
            z.object({
              type: z.literal("postgres-password"),
              storeId: z.string(),
            }),
            z.object({
              type: z.literal("postgres-database"),
              storeId: z.string(),
            }),
          ])
          .optional(),
        decrypted: z.boolean().optional(),
      }),
    )
    .optional(),
  framework: z
    .union([
      z.literal("blitzjs"),
      z.literal("nextjs"),
      z.literal("gatsby"),
      z.literal("remix"),
      z.literal("astro"),
      z.literal("hexo"),
      z.literal("eleventy"),
      z.literal("docusaurus-2"),
      z.literal("docusaurus"),
      z.literal("preact"),
      z.literal("solidstart"),
      z.literal("dojo"),
      z.literal("ember"),
      z.literal("vue"),
      z.literal("scully"),
      z.literal("ionic-angular"),
      z.literal("angular"),
      z.literal("polymer"),
      z.literal("svelte"),
      z.literal("sveltekit"),
      z.literal("sveltekit-1"),
      z.literal("ionic-react"),
      z.literal("create-react-app"),
      z.literal("gridsome"),
      z.literal("umijs"),
      z.literal("sapper"),
      z.literal("saber"),
      z.literal("stencil"),
      z.literal("nuxtjs"),
      z.literal("redwoodjs"),
      z.literal("hugo"),
      z.literal("jekyll"),
      z.literal("brunch"),
      z.literal("middleman"),
      z.literal("zola"),
      z.literal("hydrogen"),
      z.literal("vite"),
      z.literal("vitepress"),
      z.literal("vuepress"),
      z.literal("parcel"),
      z.literal("sanity"),
      z.literal("storybook"),
    ])
    .optional(),
  gitForkProtection: z.boolean().optional(),
  gitLFS: z.boolean().optional(),
  id: z.string(),
  latestDeployments: z
    .array(
      z.object({
        alias: z.array(z.string()).optional(),
        aliasAssigned: z.union([z.number(), z.boolean(), z.null()]).nullish(),
        aliasError: z
          .object({
            code: z.string(),
            message: z.string(),
          })
          .optional()
          .nullable(),
        aliasFinal: z.string().optional().nullable(),
        automaticAliases: z.array(z.string()).optional(),
        builds: z
          .array(
            z.object({
              use: z.string(),
              src: z.string().optional(),
              dest: z.string().optional(),
            }),
          )
          .optional(),
        connectBuildsEnabled: z.boolean().optional(),
        connectConfigurationId: z.string().optional(),
        createdAt: z.number(),
        createdIn: z.string(),
        creator: z
          .object({
            email: z.string(),
            githubLogin: z.string().optional(),
            gitlabLogin: z.string().optional(),
            uid: z.string(),
            username: z.string(),
          })
          .nullable(),
        deploymentHostname: z.string(),
        name: z.string(),
        forced: z.boolean().optional(),
        id: z.string(),
        meta: z.record(z.string()).optional(),
        monorepoManager: z.string().optional().nullable(),
        plan: z.union([
          z.literal("pro"),
          z.literal("enterprise"),
          z.literal("hobby"),
          z.literal("oss"),
        ]),
        private: z.boolean(),
        readyState: z.union([
          z.literal("BUILDING"),
          z.literal("ERROR"),
          z.literal("INITIALIZING"),
          z.literal("QUEUED"),
          z.literal("READY"),
          z.literal("CANCELED"),
        ]),
        readySubstate: z
          .union([z.literal("STAGED"), z.literal("PROMOTED")])
          .optional(),
        requestedAt: z.number().optional(),
        target: z.string().optional().nullable(),
        teamId: z.string().optional().nullable(),
        type: z.literal("LAMBDAS"),
        url: z.string(),
        userId: z.string(),
        withCache: z.boolean().optional(),
        checksConclusion: z
          .union([
            z.literal("succeeded"),
            z.literal("failed"),
            z.literal("skipped"),
            z.literal("canceled"),
          ])
          .optional(),
        checksState: z
          .union([
            z.literal("registered"),
            z.literal("running"),
            z.literal("completed"),
          ])
          .optional(),
        readyAt: z.number().optional(),
        buildingAt: z.number().optional(),
        previewCommentsEnabled: z.boolean().optional(),
      }),
    )
    .optional(),
  link: z
    .union([
      z.object({
        org: z.string().optional(),
        repo: z.string().optional(),
        repoId: z.number().optional(),
        type: z.literal("github").optional(),
        createdAt: z.number().optional(),
        deployHooks: z.array(
          z.object({
            createdAt: z.number().optional(),
            id: z.string(),
            name: z.string(),
            ref: z.string(),
            url: z.string(),
          }),
        ),
        gitCredentialId: z.string().optional(),
        updatedAt: z.number().optional(),
        sourceless: z.boolean().optional(),
        productionBranch: z.string().optional(),
      }),
      z.object({
        projectId: z.string().optional(),
        projectName: z.string().optional(),
        projectNameWithNamespace: z.string().optional(),
        projectNamespace: z.string().optional(),
        projectUrl: z.string().optional(),
        type: z.literal("gitlab").optional(),
        createdAt: z.number().optional(),
        deployHooks: z.array(
          z.object({
            createdAt: z.number().optional(),
            id: z.string(),
            name: z.string(),
            ref: z.string(),
            url: z.string(),
          }),
        ),
        gitCredentialId: z.string().optional(),
        updatedAt: z.number().optional(),
        sourceless: z.boolean().optional(),
        productionBranch: z.string().optional(),
      }),
      z.object({
        name: z.string().optional(),
        slug: z.string().optional(),
        owner: z.string().optional(),
        type: z.literal("bitbucket").optional(),
        uuid: z.string().optional(),
        workspaceUuid: z.string().optional(),
        createdAt: z.number().optional(),
        deployHooks: z.array(
          z.object({
            createdAt: z.number().optional(),
            id: z.string(),
            name: z.string(),
            ref: z.string(),
            url: z.string(),
          }),
        ),
        gitCredentialId: z.string().optional(),
        updatedAt: z.number().optional(),
        sourceless: z.boolean().optional(),
        productionBranch: z.string().optional(),
      }),
    ])
    .optional(),
  name: z.string(),
  nodeVersion: z.union([
    z.literal("18.x"),
    z.literal("16.x"),
    z.literal("14.x"),
    z.literal("12.x"),
    z.literal("10.x"),
  ]),
  outputDirectory: z.string().optional().nullable(),
  passwordProtection: z.record(z.unknown()).optional().nullable(),
  productionDeploymentsFastLane: z.boolean().optional(),
  publicSource: z.boolean().optional().nullable(),
  rootDirectory: z.string().optional().nullable(),
  serverlessFunctionRegion: z.string().optional().nullable(),
  skipGitConnectDuringLink: z.boolean().optional(),
  sourceFilesOutsideRootDirectory: z.boolean().optional(),
  ssoProtection: z
    .object({
      deploymentType: z.union([
        z.literal("all"),
        z.literal("preview"),
        z.literal("prod_deployment_urls_and_all_previews"),
      ]),
    })
    .optional()
    .nullable(),
  targets: z
    .record(
      z
        .object({
          alias: z.array(z.string()).optional(),
          aliasAssigned: z.union([z.number(), z.boolean(), z.null()]).nullish(),
          aliasError: z
            .object({
              code: z.string(),
              message: z.string(),
            })
            .optional()
            .nullable(),
          aliasFinal: z.string().optional().nullable(),
          automaticAliases: z.array(z.string()).optional(),
          builds: z
            .array(
              z.object({
                use: z.string(),
                src: z.string().optional(),
                dest: z.string().optional(),
              }),
            )
            .optional(),
          connectBuildsEnabled: z.boolean().optional(),
          connectConfigurationId: z.string().optional(),
          createdAt: z.number(),
          createdIn: z.string(),
          creator: z
            .object({
              email: z.string(),
              githubLogin: z.string().optional(),
              gitlabLogin: z.string().optional(),
              uid: z.string(),
              username: z.string(),
            })
            .nullable(),
          deploymentHostname: z.string(),
          name: z.string(),
          forced: z.boolean().optional(),
          id: z.string(),
          meta: z.record(z.string()).optional(),
          monorepoManager: z.string().optional().nullable(),
          plan: z.union([
            z.literal("pro"),
            z.literal("enterprise"),
            z.literal("hobby"),
            z.literal("oss"),
          ]),
          private: z.boolean(),
          readyState: z.union([
            z.literal("BUILDING"),
            z.literal("ERROR"),
            z.literal("INITIALIZING"),
            z.literal("QUEUED"),
            z.literal("READY"),
            z.literal("CANCELED"),
          ]),
          readySubstate: z
            .union([z.literal("STAGED"), z.literal("PROMOTED")])
            .optional(),
          requestedAt: z.number().optional(),
          target: z.string().optional().nullable(),
          teamId: z.string().optional().nullable(),
          type: z.literal("LAMBDAS"),
          url: z.string(),
          userId: z.string(),
          withCache: z.boolean().optional(),
          checksConclusion: z
            .union([
              z.literal("succeeded"),
              z.literal("failed"),
              z.literal("skipped"),
              z.literal("canceled"),
            ])
            .optional(),
          checksState: z
            .union([
              z.literal("registered"),
              z.literal("running"),
              z.literal("completed"),
            ])
            .optional(),
          readyAt: z.number().optional(),
          buildingAt: z.number().optional(),
          previewCommentsEnabled: z.boolean().optional(),
        })
        .nullable(),
    )
    .optional(),
  transferCompletedAt: z.number().optional(),
  transferStartedAt: z.number().optional(),
  transferToAccountId: z.string().optional(),
  transferredFromAccountId: z.string().optional(),
  updatedAt: z.number().optional(),
  live: z.boolean().optional(),
  enablePreviewFeedback: z.boolean().optional().nullable(),
  permissions: z.object({}).optional(),
  lastRollbackTarget: z.record(z.unknown()).optional().nullable(),
  lastAliasRequest: z
    .object({
      fromDeploymentId: z.string(),
      toDeploymentId: z.string(),
      jobStatus: z.union([
        z.literal("succeeded"),
        z.literal("failed"),
        z.literal("skipped"),
        z.literal("pending"),
        z.literal("in-progress"),
      ]),
      requestedAt: z.number(),
      type: z.union([z.literal("promote"), z.literal("rollback")]),
    })
    .optional()
    .nullable(),
  hasFloatingAliases: z.boolean().optional(),
  protectionBypass: z
    .record(
      z.union([
        z.object({
          createdAt: z.number(),
          createdBy: z.string(),
          scope: z.union([
            z.literal("shareable-link"),
            z.literal("automation-bypass"),
          ]),
        }),
        z.object({
          createdAt: z.number(),
          lastUpdatedAt: z.number(),
          lastUpdatedBy: z.string(),
          access: z.union([z.literal("requested"), z.literal("granted")]),
          scope: z.literal("user"),
        }),
      ]),
    )
    .optional(),
  hasActiveBranches: z.boolean().optional(),
  trustedIps: z
    .union([
      z.object({
        deploymentType: z.union([
          z.literal("all"),
          z.literal("preview"),
          z.literal("prod_deployment_urls_and_all_previews"),
          z.literal("production"),
        ]),
        addresses: z.array(
          z.object({
            value: z.string(),
            note: z.string().optional(),
          }),
        ),
        protectionMode: z.union([
          z.literal("additional"),
          z.literal("exclusive"),
        ]),
      }),
      z.object({
        deploymentType: z.union([
          z.literal("all"),
          z.literal("preview"),
          z.literal("prod_deployment_urls_and_all_previews"),
          z.literal("production"),
        ]),
      }),
    ])
    .optional(),
  gitComments: z
    .object({
      onPullRequest: z.boolean(),
      onCommit: z.boolean(),
    })
    .optional(),
});

export const projectsSchema = z.object({
  projects: z.array(projectSchema),
  pagination: z.object({
    count: z.number(),
    next: z.number().nullable(),
    prev: z.number().nullable(),
  }),
});
