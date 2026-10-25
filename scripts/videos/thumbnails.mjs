// Render the thumbnail of every recording that has one to
// .recordings/final/<name>.png. Extra arguments go to `remotion still`.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const recordings = join(import.meta.dirname, "../../.recordings");
const remotionDir = join(recordings, "remotion");
const names = existsSync(remotionDir)
  ? readdirSync(remotionDir).filter((name) =>
      // The same rule as thumbnailsFrom in src/recordings.ts.
      ["thumbnail.png", "terminal.json", "slack.json"].some((file) =>
        existsSync(join(remotionDir, name, file)),
      ),
    )
  : [];
if (!names.length) {
  console.error(
    "no thumbnails: record a tutorial with node scripts/record.mjs <name> --remotion",
  );
  process.exit(1);
}
for (const name of names) {
  const out = join(recordings, "final", `${name}.png`);
  const run = spawnSync(
    "remotion",
    ["still", `${name}-thumbnail`, out, ...process.argv.slice(2)],
    { stdio: "inherit", cwd: import.meta.dirname },
  );
  if (run.error) throw run.error;
  if (run.status !== 0) process.exit(run.status ?? 1);
  console.log(out);
}
