/**
 * Preload file for bun test.
 * Runs before any test file is loaded, ensuring env vars are set
 * before module-level env validations (e.g. @openstatus/emails) fire.
 */
process.env.RESEND_API_KEY = "test-key";
