# OpenClaw plugin for Claude Code

This plugin is for Claude Code users who want to delegate code reviews or tasks to the
**OpenClaw CLI** ([docs.openclaw.ai](https://docs.openclaw.ai/)) — a self-hosted multi-channel
gateway that runs AI agents and bridges them to chat apps (Telegram, Discord, WhatsApp, etc.).

## What You Get

- `/openclaw:review` for a normal read-only review
- `/openclaw:adversarial-review` for a steerable challenge review
- `/openclaw:rescue` to delegate investigation, a fix request, or follow-up work (runs `task`)
- `/openclaw:transfer` to import the current Claude Code session as a resumable OpenClaw session
- `/openclaw:status`, `/openclaw:result`, and `/openclaw:cancel` to track background jobs
- `/openclaw:setup` to verify the CLI and authentication

## Requirements

- **`openclaw` CLI** installed locally. Install with: `npm install -g openclaw@latest`
- Onboarding: `openclaw onboard --install-daemon` (creates `~/.openclaw/openclaw.json`)
- **Node.js 18.18 or later**

## Installing the scaffold

```bash
/plugin marketplace add <your-org>/openclaw-plugin-cc
/plugin install openclaw@agents-plugin-cc-openclaw
```

## Cross-agent delegation

`/openclaw:rescue` (and `openclaw-companion.mjs task` directly) accepts `--delegate-to=<agent>`
to route the prompt through another plugin's companion script instead of `openclaw` (e.g.
`--delegate-to=kilo`). Behavior:

1. If the target agent's companion is fully implemented, its output is returned as-is.
2. If the target's companion is a stub, `openclaw-companion.mjs` automatically falls back to
   invoking that agent's CLI binary directly (see `DIRECT_INVOCATION` in
   `scripts/lib/delegate.mjs`).

Extra flags that apply to the fallback path:

- `--prompt=<text>` — pass the prompt unambiguously instead of relying on trailing
  positional args (recommended when the prompt contains flag-like tokens).
- `--timeout=<ms>` — override the default 60s fallback timeout for a single call.
  You can also set the `CLAUDE_PLUGIN_DELEGATE_TIMEOUT_MS` environment variable to
  change the default for every delegated call.
- `--background` — when the fallback triggers, the target CLI is spawned detached and
  the command returns immediately with a PID and log file path instead of blocking.

## Reference

See `../kilo-plugin-cc/` — the reference implementation this plugin's scripts were
scaffolded from (`scripts/lib/delegate.mjs` and `render.mjs` are intentionally kept
byte-identical between the two repos; mirror any change to shared delegation logic there).

## License

Apache-2.0