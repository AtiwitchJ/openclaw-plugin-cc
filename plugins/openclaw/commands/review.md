---
description: Run an OpenClaw code review against local git state
argument-hint: '[--wait|--background] [--base <ref>] [--scope auto|working-tree|branch]'
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash(node:*), Bash(git:*), AskUserQuestion
---

Run an OpenClaw review through the shared plugin runtime.

Raw slash-command arguments:
`$ARGUMENTS`

Core constraint:
- This command is review-only.
- Do not fix issues, apply patches, or suggest that you are about to make changes.
- Your only job is to run the review and return OpenClaw's output verbatim to the user.

Execution mode rules:
- If the raw arguments include `--wait`, do not ask. Run the review in the foreground.
- If the raw arguments include `--background`, do not ask. Run the review in a Claude background task.
- Otherwise, estimate the review size before asking using `git status --short --untracked-files=all` and `git diff --shortstat`.
- Then use `AskUserQuestion` exactly once with two options, putting the recommended option first and suffixing its label with `(Recommended)`:
  - `Wait for results`
  - `Run in background`

Foreground flow:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/openclaw-companion.mjs" review "$ARGUMENTS"
```

- Return the command stdout verbatim.

Background flow:

```typescript
Bash({
  command: `node "${CLAUDE_PLUGIN_ROOT}/scripts/openclaw-companion.mjs" review "$ARGUMENTS"`,
  description: "OpenClaw review",
  run_in_background: true
})
```

- After launching, tell the user: "OpenClaw review started in the background. Check `/openclaw:status` for progress."