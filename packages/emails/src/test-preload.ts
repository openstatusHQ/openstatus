/**
 * Test env setup. Import this FIRST in any test file so env vars are set
 * before module-level env validations fire on import.
 *
 * `./env` validates RESEND_API_KEY at module load and snapshots
 * NODE_ENV, so both have to be in place before `./client` or `./send` load.
 */
process.env.NODE_ENV = "test";
process.env.RESEND_API_KEY ??= "test-key";
