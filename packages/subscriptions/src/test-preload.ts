/**
 * Test env setup. Import this FIRST in any test file so env vars are set
 * before module-level env validations (e.g. @openstatus/emails, @openstatus/db)
 * fire on import.
 *
 * Bun's test runner set NODE_ENV=test automatically; Deno does not, so we set
 * it here. The @openstatus/db env hack maps NODE_ENV=test to the local turso
 * URL, and @openstatus/emails validates RESEND_API_KEY at module load.
 */
process.env.NODE_ENV = "test";
process.env.RESEND_API_KEY ??= "test-key";
