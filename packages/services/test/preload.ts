// Bun test preload. Runs once before any test file is imported.
//
// `packages/services/src/status-report/notify.ts` imports
// `@openstatus/subscriptions`, which transitively imports
// `@openstatus/emails`. `@openstatus/emails` validates `RESEND_API_KEY`
// via `@t3-oss/env-core` at module-load time and throws on missing.
//
// Tests never exercise the real dispatch path — they assert on db state
// and audit rows. Stubbing the env var lets the import graph resolve
// without plumbing a real Resend key (which CI / local dev shouldn't
// need just to run unit tests).
if (!process.env.RESEND_API_KEY) {
  process.env.RESEND_API_KEY = "re_test_stub";
}
