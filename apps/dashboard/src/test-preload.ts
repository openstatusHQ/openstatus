// Import FIRST in every test file: `@openstatus/emails` validates
// RESEND_API_KEY and snapshots NODE_ENV on import. Development keeps
// EmailClient off the network.
Object.assign(process.env, { NODE_ENV: "development" });
process.env.RESEND_API_KEY ??= "test-key";
