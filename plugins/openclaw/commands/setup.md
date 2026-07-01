---
description: Check whether the local OpenClaw CLI is ready and authenticated
argument-hint: '[]'
disable-model-invocation: true
allowed-tools: Bash(node:*), Bash(npm:*), AskUserQuestion
---

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/openclaw-companion.mjs" setup --json $ARGUMENTS
```

If the result says OpenClaw is unavailable and npm is available:
- Use `AskUserQuestion` exactly once to ask whether Claude should install OpenClaw now.
- Put the install option first and suffix it with `(Recommended)`.
- Use these two options:
  - `Install OpenClaw (Recommended)`
  - `Skip for now`
- If the user chooses install, run:

```bash
npm install -g openclaw@latest
```

- Then rerun:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/openclaw-companion.mjs" setup --json $ARGUMENTS
```

If OpenClaw is already installed or npm is unavailable:
- Do not ask about installation.

Output rules:
- Present the final setup output to the user.
- If installation was skipped, present the original setup output.
- If OpenClaw is installed but not authenticated, preserve the guidance to run `!openclaw onboard`.