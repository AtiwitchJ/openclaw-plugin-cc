---
name: openclaw-cli-runtime
description: Operational guidance for calling the OpenClaw CLI from this plugin's companion script.
---

# OpenClaw CLI runtime

The OpenClaw plugin wraps the **OpenClaw CLI**, a self-hosted gateway that connects chat
apps (Discord, Telegram, WhatsApp, etc.) to AI coding agents. The binary is invoked as
`openclaw`.

> **Status:** this is a scaffold skill. Once `scripts/lib/openclaw.mjs` is implemented,
> replace the placeholder below with real operational notes pulled from
> `kilo-plugin-cc/plugins/kilo/skills/kilo-cli-runtime/SKILL.md`.

## Binary

- Command name: `openclaw`
- Install: `npm install -g openclaw@latest`
- Onboarding: `openclaw onboard --install-daemon` (creates `~/.openclaw/openclaw.json`)
- Documentation: https://docs.openclaw.ai/

## Placeholder invocation shape

Until the wrapper is implemented, the companion stubs return:

- `getOpenClawAvailability(cwd)` -> `{ available, detail }` (probes `openclaw --version`)
- `getOpenClawAuthStatus(cwd)` -> `{ available, loggedIn, detail }`
- `runOpenClaw(cwd, options)` -> throws (not implemented)
- `findLatestResumableSession(cwd)` -> `null`

## Next steps

1. Document the real `openclaw` flags (run subcommand, model selector, session resume, etc.).
2. Capture the JSON event shape so `runOpenClaw` can parse stdout the same way `kilo.mjs` does.
3. Update this file with the actual `openclaw <subcommand> [flags] "<prompt>"` shape.