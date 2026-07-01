#!/usr/bin/env node
/**
 * openclaw-companion - dispatcher for the OpenClaw plugin.
 *
 * Mirrors claude-companion.mjs but invokes `openclaw agent --local --message ...`.
 * Supports cross-agent delegation via `--delegate-to=<agent>`.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import { parseArgs, splitRawArgumentString } from "./lib/args.mjs";
import {
  ensureOpenclawAvailable,
  findLatestResumableSession,
  getOpenClawAuthStatus,
  getOpenClawAvailability,
  runOpenClaw
} from "./lib/openclaw.mjs";
import {
  generateJobId,
  listJobs,
  upsertJob,
  writeJobFile
} from "./lib/state.mjs";
import { resolveWorkspaceRoot } from "./lib/workspace.mjs";
import {
  buildSingleJobSnapshot,
  buildStatusSnapshot,
  readStoredJob,
  resolveResultJob
} from "./lib/job-control.mjs";
import {
  appendLogLine,
  createJobLogFile,
  createJobProgressUpdater,
  createJobRecord,
  createProgressReporter,
  runTrackedJob
} from "./lib/tracked-jobs.mjs";
import {
  renderCancelReport,
  renderJobStatusReport,
  renderStatusReport,
  renderStoredJobResult,
  renderSetupReport,
  renderTaskResult
} from "./lib/render.mjs";
import {
  createDelegateLogFile,
  extractDelegatePrompt,
  extractDelegateTimeoutMs,
  invokeDirect,
  isStubError
} from "./lib/delegate.mjs";

const ROOT_DIR = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

const KNOWN_COMPANIONS = {
  kilo: "kilo-plugin-cc",
  claude: "claude-plugin-cc",
  openclaw: "openclaw-plugin-cc",
  opencode: "opencode-plugin-cc",
  antigravity: "antigravity-plugin-cc",
  cursor: "cursor-plugin-cc",
  hermes: "hermes-plugin-cc",
  jules: "jules-plugin-cc"
};

function resolveCompanionScript(agent) {
  const repo = KNOWN_COMPANIONS[agent];
  if (!repo) {
    throw new Error(`Unknown agent "${agent}". Known: ${Object.keys(KNOWN_COMPANIONS).join(", ")}`);
  }
  const candidates = [
    path.join("D:\\mind", repo, "plugins", agent, "scripts", `${agent}-companion.mjs`),
    path.join(process.cwd(), "..", repo, "plugins", agent, "scripts", `${agent}-companion.mjs`),
    path.resolve(ROOT_DIR, "..", "..", "..", "..", repo, "plugins", agent, "scripts", `${agent}-companion.mjs`)
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(
    `Could not find ${agent}-companion.mjs. Tried:\n  ${candidates.join("\n  ")}`
  );
}

async function delegateToAgent(agent, argv) {
  const script = resolveCompanionScript(agent);
  const result = spawnSync(process.execPath, [script, ...argv], {
    stdio: ["pipe", "pipe", "pipe"],
    env: process.env,
    cwd: process.cwd(),
    encoding: "utf8"
  });
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  const stubDetected = isStubError(stderr, stdout, result.status);

  if (!stubDetected && typeof result.status === "number") {
    process.stdout.write(stdout);
    if (stderr) process.stderr.write(stderr);
    process.exit(result.error ? 1 : result.status);
    return;
  }

  process.stderr.write(
    `> ${agent} companion is a stub; falling back to direct ${agent} CLI invocation\n`
  );

  try {
    // argv[0] is always the subcommand (e.g. "task"); only the args after it are prompt candidates.
    const prompt = extractDelegatePrompt(argv.slice(1));
    const background = argv.includes("--background");
    const timeoutMs = extractDelegateTimeoutMs(argv);
    const logFile = background ? createDelegateLogFile(agent) : null;

    const fallback = await invokeDirect(agent, prompt || "(no prompt)", process.cwd(), {
      timeoutMs,
      background,
      logFile
    });

    if (fallback.background) {
      process.stdout.write(
        `Delegated ${agent} task running in background (pid ${fallback.pid ?? "unknown"}).${logFile ? ` Logs: ${logFile}` : ""}\n`
      );
      process.exit(0);
      return;
    }

    process.stdout.write(`${fallback.stdout}\n`);
    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`> Direct fallback failed: ${message}\n`);
    process.exit(1);
  }
}

function printUsage() {
  console.log(
    [
      "Usage:",
      "  node scripts/openclaw-companion.mjs setup [--json]",
      "  node scripts/openclaw-companion.mjs task [--background] [--delegate-to=<agent>] [--resume] [--agent <name>] [--prompt=<text>] [--timeout=<ms>] [prompt]",
      "  node scripts/openclaw-companion.mjs status [job-id] [--json]",
      "  node scripts/openclaw-companion.mjs result [job-id] [--json]",
      "  node scripts/openclaw-companion.mjs cancel [job-id] [--json]",
      `Known agents for --delegate-to: ${Object.keys(KNOWN_COMPANIONS).join(", ")}`
    ].join("\n")
  );
}

function outputResult(value, asJson) {
  if (asJson) {
    console.log(JSON.stringify(value, null, 2));
  } else {
    process.stdout.write(typeof value === "string" ? value : `${value}\n`);
  }
}

function normalizeArgv(argv) {
  if (argv.length === 1) return splitRawArgumentString(argv[0] ?? "");
  return argv;
}

function parseCommandInput(argv, config = {}) {
  return parseArgs(normalizeArgv(argv), { ...config });
}

function resolveCommandCwd(options = {}) {
  return options.cwd ? path.resolve(process.cwd(), options.cwd) : process.cwd();
}

function firstMeaningfulLine(text, fallback) {
  const line = String(text ?? "")
    .split(/\r?\n/)
    .map((value) => value.trim())
    .find(Boolean);
  return line ?? fallback;
}

async function handleSetup(argv) {
  const { options } = parseCommandInput(argv, {
    valueOptions: ["cwd"],
    booleanOptions: ["json"]
  });
  const cwd = resolveCommandCwd(options);
  const workspaceRoot = resolveWorkspaceRoot(cwd);
  const openclawStatus = getOpenClawAvailability(cwd);
  const authStatus = await getOpenClawAuthStatus(cwd);
  const { getConfig } = await import("./lib/state.mjs");
  const config = getConfig(workspaceRoot);

  const nextSteps = [];
  if (!openclawStatus.available) {
    nextSteps.push("Install OpenClaw with `npm install -g openclaw@latest`.");
  }
  if (openclawStatus.available && !authStatus.loggedIn) {
    nextSteps.push("Run `openclaw onboard --install-daemon` to finish setup.");
  }

  const report = {
    ready: openclawStatus.available && authStatus.loggedIn,
    openclaw: openclawStatus,
    auth: authStatus,
    workspaceRoot,
    config,
    nextSteps
  };
  outputResult(options.json ? report : renderSetupReport({ ...report, kilo: openclawStatus, auth: authStatus, workspaceRoot, nextSteps }), options.json);
}

async function executeTaskRun({ cwd, prompt, resume, agent, onProgress, logFile }) {
  ensureOpenclawAvailable();

  let sessionId = null;
  let effectiveResume = Boolean(resume);
  if (effectiveResume) {
    const latest = await findLatestResumableSession(cwd);
    if (!latest) {
      throw new Error("No previous OpenClaw session was found for this repository.");
    }
    sessionId = latest.id;
  }

  if (!prompt && !sessionId) {
    throw new Error("Provide a prompt, a prompt file, piped stdin, or use --resume.");
  }

  const result = await runOpenClaw(cwd, {
    prompt,
    agent: agent ?? null,
    sessionId,
    onProgress,
    logFile,
    json: false
  });

  const failureMessage = result.error ?? result.stderr ?? "";
  const rendered = renderTaskResult(
    { text: result.text, failureMessage, reasoningSummary: [] },
    { title: effectiveResume ? "OpenClaw Resume" : "OpenClaw Task", jobId: null, write: false, agentName: "OpenClaw" }
  );

  return {
    exitStatus: result.status,
    sessionId: result.sessionId ?? sessionId,
    payload: {
      status: result.status,
      sessionId: result.sessionId ?? sessionId,
      text: result.text,
      stderr: result.stderr,
      error: result.error,
      resumed: effectiveResume
    },
    rendered,
    summary: firstMeaningfulLine(result.text, firstMeaningfulLine(failureMessage, "OpenClaw task finished.")),
    jobTitle: effectiveResume ? "OpenClaw Resume" : "OpenClaw Task",
    jobClass: "task",
    write: false
  };
}

async function runForegroundCommand(job, runner, options = {}) {
  const logFile = options.logFile ?? createJobLogFile(job.workspaceRoot, job.id, job.title);
  job.logFile = logFile;
  const progress = createProgressReporter({
    stderr: !options.json,
    logFile,
    onEvent: createJobProgressUpdater(job.workspaceRoot, job.id)
  });
  const execution = await runTrackedJob({ ...job, logFile }, () => runner(progress), { logFile });
  outputResult(options.json ? execution.payload : execution.rendered, options.json);
  if (execution.exitStatus !== 0) process.exitCode = execution.exitStatus || 1;
  return execution;
}

async function handleTask(argv) {
  const { options, positionals } = parseCommandInput(argv, {
    valueOptions: ["cwd", "prompt-file", "delegate-to", "agent"],
    booleanOptions: ["json", "resume", "fresh", "background"]
  });

  if (options["delegate-to"]) {
    const agent = String(options["delegate-to"]);
    const subcommand = process.argv[2];
    const remaining = process.argv.slice(3).filter((arg) => !arg.startsWith("--delegate-to=") && arg !== "--delegate-to");
    await delegateToAgent(agent, [subcommand, ...remaining]);
    return;
  }

  const cwd = resolveCommandCwd(options);
  const workspaceRoot = resolveWorkspaceRoot(cwd);
  const resume = Boolean(options.resume);
  const fresh = Boolean(options.fresh);
  if (resume && fresh) {
    throw new Error("Choose either --resume or --fresh.");
  }

  const prompt = (() => {
    if (options["prompt-file"]) {
      return fs.readFileSync(path.resolve(cwd, options["prompt-file"]), "utf8");
    }
    const positionalPrompt = positionals.join(" ");
    return positionalPrompt || (fs.readFileSync(0, "utf8") || "").trim();
  })();

  const job = createJobRecord({
    id: generateJobId("task"),
    kind: "task",
    kindLabel: "task",
    title: resume ? "OpenClaw Resume" : "OpenClaw Task",
    workspaceRoot,
    jobClass: "task",
    summary: firstMeaningfulLine(prompt, "Task"),
    write: false,
    request: { cwd, prompt, resume, agent: options.agent ?? null }
  });

  await runForegroundCommand(
    job,
    (progress) =>
      executeTaskRun({
        cwd,
        prompt,
        resume,
        agent: options.agent ?? null,
        onProgress: progress,
        logFile: job.logFile
      }),
    { json: options.json }
  );
}

async function handleStatus(argv) {
  const { options, positionals } = parseCommandInput(argv, {
    valueOptions: ["cwd"],
    booleanOptions: ["json", "all"]
  });
  const cwd = resolveCommandCwd(options);
  const reference = positionals[0] ?? "";
  if (reference) {
    const snapshot = buildSingleJobSnapshot(cwd, reference);
    outputResult(options.json ? snapshot : renderJobStatusReport(snapshot.job), options.json);
    return;
  }
  const report = buildStatusSnapshot(cwd, { all: options.all });
  outputResult(options.json ? report : renderStatusReport(report), options.json);
}

function handleResult(argv) {
  const { options, positionals } = parseCommandInput(argv, {
    valueOptions: ["cwd"],
    booleanOptions: ["json"]
  });
  const cwd = resolveCommandCwd(options);
  const reference = positionals[0] ?? "";
  const { workspaceRoot, job } = resolveResultJob(cwd, reference);
  const storedJob = readStoredJob(workspaceRoot, job.id);
  outputResult(options.json ? { job, storedJob } : renderStoredJobResult(job, storedJob, { agentName: "OpenClaw" }), options.json);
}

async function handleCancel(argv) {
  const { options, positionals } = parseCommandInput(argv, {
    valueOptions: ["cwd"],
    booleanOptions: ["json"]
  });
  const cwd = resolveCommandCwd(options);
  const reference = positionals[0] ?? "";
  const { workspaceRoot, job } = resolveResultJob(cwd, reference);
  appendLogLine(job.logFile, "Cancelled by user.");
  const completedAt = new Date().toISOString();
  const nextJob = {
    ...job,
    status: "cancelled",
    phase: "cancelled",
    pid: null,
    completedAt,
    errorMessage: "Cancelled by user."
  };
  writeJobFile(workspaceRoot, job.id, { ...(readStoredJob(workspaceRoot, job.id) ?? {}), ...nextJob, cancelledAt: completedAt });
  upsertJob(workspaceRoot, {
    id: job.id,
    status: "cancelled",
    phase: "cancelled",
    pid: null,
    errorMessage: "Cancelled by user.",
    completedAt
  });
  const payload = { jobId: job.id, status: "cancelled", title: job.title };
  outputResult(options.json ? payload : renderCancelReport(nextJob), options.json);
}

async function main() {
  const [subcommand, ...argv] = process.argv.slice(2);
  if (!subcommand || subcommand === "help" || subcommand === "--help") {
    printUsage();
    return;
  }
  switch (subcommand) {
    case "setup":
      await handleSetup(argv);
      break;
    case "task":
      await handleTask(argv);
      break;
    case "status":
      await handleStatus(argv);
      break;
    case "result":
      handleResult(argv);
      break;
    case "cancel":
      await handleCancel(argv);
      break;
    default:
      throw new Error(`Unknown subcommand: ${subcommand}`);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});