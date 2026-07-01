/**
 * Test env setup. Import this FIRST so env vars are set before module-level
 * env validations fire on import.
 *
 * Bun's test runner set NODE_ENV=test automatically; Deno does not. This
 * package's env skips validation when NODE_ENV=test, and @openstatus/emails
 * validates RESEND_API_KEY at module load.
 */
process.env.NODE_ENV = "test";
process.env.RESEND_API_KEY ??= "test-key";
