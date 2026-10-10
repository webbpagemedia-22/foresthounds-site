// Sends newly merged weekly headline posts to Buffer.
//
//   node automation/headline-to-buffer.mjs --before <sha> --after <sha> [--dry-run]
//   node automation/headline-to-buffer.mjs --file <path/to/x.social.json> [--dry-run]
//
// Needs BUFFER_API_KEY (unless --dry-run) and GH_TOKEN for closing the other options.
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { addedSocialFiles, validateSocial, buildPostInput, waitForLive, sendPost } from "./buffer.mjs";

const { values: args } = parseArgs({
  options: {
    before: { type: "string" },
    after: { type: "string" },
    file: { type: "string" },
    "dry-run": { type: "boolean", default: false },
  },
});
const dryRun = args["dry-run"];
const channels = JSON.parse(readFileSync(new URL("./buffer-channels.json", import.meta.url)));
const run = (cmd, cmdArgs) => execFileSync(cmd, cmdArgs, { encoding: "utf8" });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const files = args.file ? [args.file] : addedSocialFiles(run("git", ["diff", "--name-status", args.before, args.after]));
if (files.length === 0) {
  console.log("No new headline posts in this change. Nothing to send.");
  process.exit(0);
}

const posts = files.map((path) => ({ path, social: JSON.parse(readFileSync(path, "utf8")) }));
const invalid = posts.flatMap(({ path, social }) => validateSocial(social, channels).map((p) => `${path}: ${p}`));
if (invalid.length) {
  console.error(`Not sending anything. Problems found:\n- ${invalid.join("\n- ")}`);
  process.exit(1);
}

// The post's date ties it to that Sunday's other options (branches headline/<date>/<slug>).
function postDate(socialPath) {
  const html = socialPath.replace(/\.social\.json$/, ".html");
  if (!existsSync(html)) return null;
  return readFileSync(html, "utf8").match(/article:published_time" content="(\d{4}-\d{2}-\d{2})"/)?.[1] ?? null;
}

function closeOtherOptions(date) {
  const open = JSON.parse(run("gh", ["pr", "list", "--label", "weekly-headline", "--state", "open", "--json", "number,headRefName"]));
  for (const pr of open.filter((pr) => pr.headRefName.startsWith(`headline/${date}/`))) {
    run("gh", ["pr", "close", String(pr.number), "--comment", "Not chosen this week."]);
    console.log(`Closed option PR #${pr.number} (${pr.headRefName})`);
  }
}

let failed = false;
for (const { path, social } of posts) {
  console.log(`\n${path}\n${social.url}`);
  if (dryRun) {
    for (const channel of channels) console.log(`[dry run] ${channel.name} (${channel.service}):\n${JSON.stringify(buildPostInput(social, channel), null, 2)}`);
    continue;
  }
  const date = postDate(path);
  if (date) closeOtherOptions(date);
  try {
    await waitForLive([social.url, social.image], { fetch, sleep });
  } catch (err) {
    console.error(err.message);
    failed = true;
    continue;
  }
  for (const channel of channels) {
    try {
      const id = await sendPost(buildPostInput(social, channel), { apiKey: process.env.BUFFER_API_KEY, fetch });
      console.log(`Queued in Buffer for ${channel.name} (${channel.service}): post ${id}`);
    } catch (err) {
      console.error(`Failed for ${channel.name} (${channel.service}): ${err.message}`);
      failed = true;
    }
  }
}
process.exit(failed ? 1 : 0);
