# Log drain integration for Vercel

Seamless installement into Vercel's log drains for your project.

## Description

When integrating the Vercel App into your project. Every request to
[openstatus.dev](https://openstatus.dev) will include the key inside of the
`Headers`.

Once we have the `access_token` token we will be able to `createLogDrain` as
authentificated user. The token is only expires after 30 minutes and is required
for the user to access the integration within vercel.

When creating the log drain, we should include a custom header to it, with an
`OpenStatus-Vercel-TOKEN: "os_xxx-yyy"` token from Unkey. That way, it is easy
to revoke tokens. We can test without but should include it. Check with Andreas
how a good use case an look like.

The new created log drain will point towards our `/api/integrations/vercel`. We
will then be able to filter them and ingest Tinybird the the logs we want to
keep. Maybe, we can start first by ingesting only errors.

1. We can start simple an only create the log drain for the user. nothing else
2. Once clear we will have to create a little `/configure` page where the user,
   authentificated within vercel, can update the log drain integration easily.

The UI for the Integration should be the bare minimum. The UX should be in the
focus. Default shadcn/ui components will do it.

- white background
- `DataTable` filled with `getLogDrains` data:
  - createdAt
  - name
  - projectId
  - dropdown menu: data can be deleted
- 'Connect'-button to add log drains to different projet

<!-- Redirect URL aka callback explaination -->

### Files

- `webhook.ts`: ingests Tinybird with the log drains
- `callback.ts`: callback for getting an access token
- `configure.ts`: simple page to configure your vercel integration authorized as
  vercel user through access token
- `client.ts`: includes all important REST API calls to vercel, updating the
  users project

### API Scopes

The following scopes are necessary:

- Log Drains (Read/Write): be able to send a request with the payload
- Projects (Read): connect log drains with projects

> We might require more scopes.
