import { createClerkClient } from "@clerk/clerk-sdk-node";

const clerk = createClerkClient({ secretKey: process.env.CLERK_API_KEY! });

// default limit is 10 - max is 500
// we have to use offset to get more, e.g. { offset: 500, limit 500 }
const users = await clerk.users.getUserList({ limit: 100 });

users.data.forEach(async (user) => {
  const firstExternalAccount = user.externalAccounts[0];
  if (firstExternalAccount) {
    console.log(firstExternalAccount);
    try {
      const accessToken = await clerk.users.getUserOauthAccessToken(
        user.id,
        // @ts-expect-error Clerk does not provide a type for provider
        firstExternalAccount.verification?.strategy,
      );
    } catch (e) {
      // REMINDER: cannot access the token if the user has not logged in since longer
      // Unprocessable Entity - "The current access token has expired and we cannot refresh it, because the authorization server hasn't provided us with a refresh token"
      // Bad Request - "Failed to retrieve a new access token from the OAuth provider"
    }
  }
});
