const ipHeaders = { deny: ["forwarded", "-ip", "remote-", "via", "-user"] };

/**
 * Spread into every `Sentry.init`. Sentry v11 collects bodies, cookies, user IPs
 * and query data unless told otherwise; this keeps the v10 (sendDefaultPii off)
 * baseline, since tRPC bodies carry status-page passwords and subscriber emails.
 */
export const sentryPrivacyDefaults = {
  attachStacktrace: false,
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: { request: ipHeaders, response: ipHeaders },
    httpBodies: [],
    urlQueryParams: ipHeaders,
    genAI: { inputs: false, outputs: false },
    mcp: { inputs: false, outputs: false },
    databaseQueryData: false,
    queues: false,
    graphQL: { document: false, variables: false },
  },
};
