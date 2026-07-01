import { binaryAvailable } from "./process.mjs";

/**
 * OpenClaw CLI wrapper - stub.
 *
 * The plugin wraps the `openclaw` binary (a multi-channel gateway for AI agents).
 * The companion script forwards prompts to `openclaw run "<prompt>"` (or equivalent)
 * and captures the response.
 *
 * To turn this into a real implementation, copy
 * `../../kilo-plugin-cc/plugins/kilo/scripts/lib/kilo.mjs` and adapt:
 *   - replace the `kilo` binary with `openclaw`
 *   - replace `--format json` with `openclaw run --output-format json` (or the
 *     equivalent flag for the installed OpenClaw version)
 *   - replace `kilo profile` auth probe with a check for `~/.openclaw/openclaw.json`
 *   - replace `kilo session list` resume lookup with whatever OpenClaw uses to
 *     enumerate sessions (likely under `~/.openclaw/sessions/`)
 */
const OPENCLAW_BINARY = "openclaw";

export function getOpenClawAvailability(cwd) {
  return binaryAvailable(OPENCLAW_BINARY, ["--version"], { cwd });
}

export async function getOpenClawAuthStatus(cwd) {
  const availability = getOpenClawAvailability(cwd);
  if (!availability.available) {
    return {
      available: false,
      loggedIn: false,
      detail: availability.detail,
      source: "availability",
      provider: null
    };
  }
  return {
    available: true,
    loggedIn: false,
    detail: "openclaw-companion is a stub. Implement scripts/lib/openclaw.mjs.",
    source: "stub",
    provider: null
  };
}

export async function runOpenClaw() {
  throw new Error(
    "openclaw-companion is a stub. Implement scripts/lib/openclaw.mjs (see kilo-plugin-cc for a working reference)."
  );
}

export async function findLatestResumableSession(cwd) {
  return null;
}

export { OPENCLAW_BINARY };