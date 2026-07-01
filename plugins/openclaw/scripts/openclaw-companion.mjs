#!/usr/bin/env node
/**
 * openclaw-companion - dispatcher stub for the OpenClaw plugin.
 *
 * Implementation plan (copy from kilo-plugin-cc/plugins/kilo/scripts/kilo-companion.mjs):
 *   - swap `import "./lib/kilo.mjs"` for `import "./lib/openclaw.mjs"`
 *   - swap `runKilo`/`getKiloAvailability`/`getKiloAuthStatus` calls for their
 *     `runOpenClaw`/`getOpenClawAvailability`/`getOpenClawAuthStatus` equivalents
 *   - the CLI binary is `openclaw`
 */
import process from "node:process";

function printUsage() {
  console.log(
    [
      "Usage:",
      "  node scripts/openclaw-companion.mjs setup [--json]",
      "  node scripts/openclaw-companion.mjs review [--wait|--background] [--base <ref>]",
      "  node scripts/openclaw-companion.mjs adversarial-review [--wait|--background] [--base <ref>] [focus text]",
      "  node scripts/openclaw-companion.mjs task [--background] [--write] [--resume|--fresh] [prompt]",
      "  node scripts/openclaw-companion.mjs status [job-id] [--json]",
      "  node scripts/openclaw-companion.mjs result [job-id] [--json]",
      "  node scripts/openclaw-companion.mjs cancel [job-id] [--json]"
    ].join("\n")
  );
}

async function main() {
  const [subcommand] = process.argv.slice(2);
  if (!subcommand || subcommand === "help" || subcommand === "--help") {
    printUsage();
    return;
  }
  process.stderr.write(
    "`openclaw-companion` is a stub. See ../../../kilo-plugin-cc/plugins/kilo/scripts/kilo-companion.mjs for a complete reference implementation. The CLI binary is `openclaw`.\n"
  );
  process.exitCode = 1;
}

main();