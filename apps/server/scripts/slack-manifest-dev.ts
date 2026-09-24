// Writes slack-manifest.dev.json (gitignored) for the local `openstatus-dev`
// app: the production manifest renamed, with every api.openstatus.dev URL
// pointed at your tunnel. The tunnel origin comes from SLACK_REDIRECT_URI in
// .env, so the manifest and the OAuth callback the server sends can't disagree.
// Also prints it, so it can be piped straight to the clipboard.
//
//   pnpm slack:manifest:dev | pbcopy   # then App Manifest → JSON → paste
import manifest from "../slack-manifest.json" with { type: "json" };

const PROD_ORIGIN = "https://api.openstatus.dev";
const DEV_NAME = "openstatus-dev";

const redirectUri = Deno.env.get("SLACK_REDIRECT_URI");
if (!redirectUri) {
  console.error(
    "SLACK_REDIRECT_URI is not set — add https://<tunnel>/slack/oauth/callback to apps/server/.env",
  );
  Deno.exit(1);
}
const devOrigin = new URL(redirectUri).origin;

const dev = structuredClone(manifest);
dev.display_information.name = DEV_NAME;
dev.features.bot_user.display_name = DEV_NAME;
dev.oauth_config.redirect_urls = [redirectUri];

const output = `${JSON.stringify(dev, null, 2).replaceAll(PROD_ORIGIN, devOrigin)}\n`;
await Deno.writeTextFile(
  new URL("../slack-manifest.dev.json", import.meta.url),
  output,
);
console.log(output);
