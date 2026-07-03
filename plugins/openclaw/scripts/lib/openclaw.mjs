import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { runCommand, binaryAvailable } from "./process.mjs";
import { buildWindowsShellCommandLine } from "./win-quote.mjs";

const OPENCLAW_BINARY = "openclaw";
const OPENCLAW_CONFIG_DIR = process.env.OPENCLAW_CONFIG_DIR ?? path.join(os.homedir(), ".openclaw");

function cleanOpenclawStderr(stderr) {
  return stderr
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line && !/^(WARN|INFO|DEBUG|ERROR)/i.test(line.trim()))
    .join("\n");
}

function spawnOpenclaw({ cwd, args, onProgress, logFile }) {
  return new Promise((resolve, reject) => {
    // openclaw only ships as a .cmd/.ps1 shim on Windows, so it must go
    // through a shell to be found at all. Node's own shell:true + array-args
    // quoting naively concatenates without escaping (DEP0190), which
    // corrupts any multi-word prompt. Build the command line ourselves with
    // proper cmd.exe-safe quoting instead of handing Node a raw args array.
    const useWindowsShell = process.platform === "win32";
    const child = useWindowsShell
      ? spawn(buildWindowsShellCommandLine(OPENCLAW_BINARY, args), {
          cwd,
          env: process.env,
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true,
          shell: true
        })
      : spawn(OPENCLAW_BINARY, args, {
          cwd,
          env: process.env,
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true,
          shell: false
        });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString("utf8");
      stdout += text;
      if (onProgress) {
        onProgress({ message: text.slice(0, 200), phase: "stdout" });
      }
    });

    child.stderr.on("data", (chunk) => {
      const text = chunk.toString("utf8");
      stderr += text;
      if (logFile) {
        fs.appendFileSync(logFile, `[stderr] ${text}`, "utf8");
      }
      if (onProgress) {
        const tail = text.trim().split(/\r?\n/).pop() ?? "";
        onProgress({ message: tail, phase: "stderr" });
      }
    });

    child.on("error", (err) => reject(err));
    child.on("close", (status, signal) => {
      resolve({ status: status ?? 0, signal, stdout, stderr });
    });
  });
}

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

  const configCheck = runCommand(OPENCLAW_BINARY, ["config", "get", "gateway"], { cwd });
  const stdout = configCheck.stdout.trim();
  const loggedIn = !configCheck.error && configCheck.status === 0 && stdout.length > 0;
  return {
    available: true,
    loggedIn,
    detail: loggedIn
      ? `OpenClaw configured (gateway=${stdout.split(/\r?\n/)[0]})`
      : "OpenClaw installed but not configured. Run `openclaw onboard --install-daemon` to finish setup.",
    source: "config-get",
    provider: "openclaw"
  };
}

export function buildOpenclawArgs({ prompt, agent, sessionId, to, json }) {
  const args = ["agent", "--local"];
  if (to) args.push("--to", to);
  else if (sessionId) args.push("--session-id", sessionId);
  else if (agent) args.push("--agent", agent);
  if (prompt) args.push("--message", prompt);
  if (json) args.push("--json");
  return args;
}

/**
 * Run an OpenClaw agent turn.
 *
 * OpenClaw's `agent` subcommand with `--local` runs the embedded agent without
 * the gateway. Output is plain text by default; `--json` produces a JSON object.
 */
export async function runOpenClaw(cwd, options = {}) {
  ensureOpenclawAvailable();
  const prompt = (options.prompt ?? "").trim();
  if (!prompt) {
    throw new Error("A prompt is required for this openclaw run.");
  }

  const args = buildOpenclawArgs({
    prompt,
    agent: options.agent ?? null,
    sessionId: options.sessionId ?? null,
    to: options.to ?? null,
    json: Boolean(options.json)
  });

  const execution = await spawnOpenclaw({
    cwd,
    args,
    onProgress: options.onProgress,
    logFile: options.logFile ?? null
  });

  const cleanedStderr = cleanOpenclawStderr(execution.stderr);
  let text = execution.stdout.trim();
  let sessionId = null;
  let error = null;
  let events = [];

  if (options.json) {
    try {
      const parsed = JSON.parse(execution.stdout);
      events.push(parsed);
      if (typeof parsed.text === "string") text = parsed.text;
      else if (typeof parsed.message === "string") text = parsed.message;
      else if (typeof parsed.result === "string") text = parsed.result;
      if (typeof parsed.session_id === "string" || typeof parsed.sessionId === "string") {
        sessionId = parsed.session_id ?? parsed.sessionId;
      }
      if (parsed.error) error = parsed.error;
    } catch {
      // not valid JSON; leave text as raw stdout
    }
  }

  if (execution.status !== 0 && !error) {
    error = cleanedStderr || `openclaw exited with status ${execution.status}`;
  }

  return {
    status: error ? 1 : execution.status,
    signal: execution.signal,
    sessionId,
    text,
    error,
    stderr: cleanedStderr,
    rawStdout: execution.stdout,
    events
  };
}

export async function findLatestResumableSession(cwd) {
  ensureOpenclawAvailable();
  const result = runCommand(OPENCLAW_BINARY, ["agent", "--list", "--json"], { cwd });
  if (!result.error && result.status === 0) {
    try {
      const parsed = JSON.parse(result.stdout);
      const sessions = Array.isArray(parsed) ? parsed : parsed.sessions ?? [];
      if (sessions.length > 0) {
        const id = sessions[0].id ?? sessions[0].session_id ?? null;
        if (id) return { id, source: "openclaw agent --list --json" };
      }
    } catch {
      // fall through
    }
  }
  return null;
}

export function ensureOpenclawAvailable() {
  const status = getOpenClawAvailability();
  if (!status.available) {
    throw new Error(
      "OpenClaw CLI is not installed. Install with `npm install -g openclaw@latest`."
    );
  }
}

export { OPENCLAW_BINARY, OPENCLAW_CONFIG_DIR };