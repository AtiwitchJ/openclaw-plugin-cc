import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildOpenclawArgs,
  getOpenClawAvailability
} from "../plugins/openclaw/scripts/lib/openclaw.mjs";

test("openclaw: buildOpenclawArgs emits `agent --local --message ...`", () => {
  const args = buildOpenclawArgs({ prompt: "hello", json: false });
  assert.equal(args[0], "agent");
  assert.ok(args.includes("--local"));
  assert.ok(args.includes("--message"));
  assert.ok(args.includes("hello"));
});

test("openclaw: buildOpenclawArgs includes --json when json=true", () => {
  const args = buildOpenclawArgs({ prompt: "x", json: true });
  assert.ok(args.includes("--json"));
});

test("openclaw: buildOpenclawArgs prefers --to when given", () => {
  const args = buildOpenclawArgs({ prompt: "x", to: "+15555550123" });
  const i = args.indexOf("--to");
  assert.equal(args[i + 1], "+15555550123");
  assert.ok(!args.includes("--agent"));
});

test("openclaw: buildOpenclawArgs falls back to --session-id", () => {
  const args = buildOpenclawArgs({ prompt: "x", sessionId: "sess-9" });
  const i = args.indexOf("--session-id");
  assert.equal(args[i + 1], "sess-9");
});

test("openclaw: buildOpenclawArgs uses --agent when no session/to", () => {
  const args = buildOpenclawArgs({ prompt: "x", agent: "ops" });
  const i = args.indexOf("--agent");
  assert.equal(args[i + 1], "ops");
});

test("openclaw: getOpenClawAvailability probes --version", () => {
  const result = getOpenClawAvailability();
  assert.equal(typeof result.available, "boolean");
  assert.equal(typeof result.detail, "string");
});