---
description: Delegate investigation, an explicit fix request, or follow-up rescue work to the OpenClaw rescue subagent
argument-hint: "[--background|--wait] [--resume|--fresh] [what OpenClaw should investigate, solve, or continue]"
allowed-tools: Bash(node:*), AskUserQuestion, Agent
---

Invoke the `openclaw:openclaw-rescue` subagent via the `Agent` tool (`subagent_type: "openclaw:openclaw-rescue"`), forwarding the raw user request as the prompt.
`openclaw:openclaw-rescue` is a subagent, not a skill — do not call `Skill(openclaw:openclaw-rescue)` (no such skill) or `Skill(openclaw:rescue)` (that re-enters this command and hangs the session).
The final user-visible response must be OpenClaw's output verbatim.

Raw user request:
$ARGUMENTS

Operating rules:

- The subagent is a thin forwarder only. It should use one `Bash` call to invoke `node "${CLAUDE_PLUGIN_ROOT}/scripts/openclaw-companion.mjs" task ...` and return that command's stdout as-is.
- Return the OpenClaw companion stdout verbatim to the user.
- If OpenClaw is missing or unauthenticated, stop and tell the user to run `/openclaw:setup`.
- If the user did not supply a request, ask what OpenClaw should investigate or fix.