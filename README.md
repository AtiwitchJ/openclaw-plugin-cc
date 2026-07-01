# OpenClaw plugin for Claude Code

This plugin is for Claude Code users who want to delegate code reviews or tasks to the
**OpenClaw CLI** ([docs.openclaw.ai](https://docs.openclaw.ai/)) — a self-hosted multi-channel
gateway that runs AI agents and bridges them to chat apps (Telegram, Discord, WhatsApp, etc.).

## What You Get (once implemented)

- `/openclaw:review` for a normal read-only review
- `/openclaw:adversarial-review` for a steerable challenge review
- `/openclaw:rescue`, `/openclaw:transfer`, `/openclaw:status`, `/openclaw:result`, and `/openclaw:cancel`
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

The scaffold ships with stub commands that will fail with a "not implemented" error
until you wire up `plugins/openclaw/scripts/lib/openclaw.mjs` and
`plugins/openclaw/scripts/openclaw-companion.mjs`.

## Implementing the plugin

1. Open `plugins/openclaw/scripts/lib/openclaw.mjs` and replace the stub functions with real
   implementations that:
   - detect `openclaw` availability (`binaryAvailable` is already imported)
   - probe authentication (`getOpenClawAuthStatus`)
   - invoke the CLI in the foreground and capture its output (`runOpenClaw`)
   - discover a resumable session if available (`findLatestResumableSession`)
2. Open `plugins/openclaw/scripts/openclaw-companion.mjs` and copy the body of
   `../kilo-plugin-cc/plugins/kilo/scripts/kilo-companion.mjs`, renaming the imports from
   `./lib/kilo.mjs` to `./lib/openclaw.mjs` and the `runKilo` calls to your new wrapper.
3. Add tests under `tests/` that cover argument parsing, state, and the new wrapper.

## Reference

See `../kilo-plugin-cc/` for a complete working example.

## License

Apache-2.0