import { test } from "node:test";
import assert from "node:assert/strict";

import { renderTaskResult, renderStoredJobResult } from "../plugins/openclaw/scripts/lib/render.mjs";

test("renderTaskResult: defaults the output header to 'OpenClaw output', not 'Kilo output' (bug #3)", () => {
  const out = renderTaskResult(
    { text: "fixed it", failureMessage: "" },
    { title: "OpenClaw Task", jobId: "task-abc", write: false }
  );
  assert.match(out, /## OpenClaw output/);
  assert.doesNotMatch(out, /## Kilo output/);
});

test("renderTaskResult: openclaw-companion.mjs passes agentName explicitly", () => {
  const out = renderTaskResult(
    { text: "fixed it", failureMessage: "" },
    { title: "OpenClaw Task", agentName: "OpenClaw" }
  );
  assert.match(out, /## OpenClaw output/);
});

test("renderStoredJobResult: defaults the output header to 'OpenClaw output'", () => {
  const job = { id: "task-1", title: "OpenClaw Task" };
  const storedJob = { text: "done" };
  const out = renderStoredJobResult(job, storedJob);
  assert.match(out, /## OpenClaw output/);
  assert.doesNotMatch(out, /## Kilo output/);
});
