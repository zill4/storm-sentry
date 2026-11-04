# Railway configuration (infrastructure as code)

`railway.ts` holds this service's Railway settings: how it builds and starts, its health check, replicas and domains. It replaces `railway.json`, which Railway stops reading on 2026-12-01.

- It's a named partial (`storm-sentry`), so it manages only this repo's service. The other service in the project (`smart-tarp-studio`) manages itself from its own repo.
- Variables are unmanaged: this file never reads or writes them.
- Railway doesn't read this folder when it deploys. Changes take effect only when someone runs `railway config apply`.
- Keep one replica. The app runs in-process pollers, so a second replica would double outbound webhooks and CRM messages.

## Plan and apply

Needs Node 22 or newer and the Railway CLI, linked to project `storm-sentry`, environment `production`.

```bash
npm ci --prefix .railway   # the Railway SDK, kept apart from the app's dependencies
railway config plan        # read-only: shows what would change
railway config apply       # shows the plan again and asks before changing anything
```

## One-time switch from railway.json

1. `railway config plan` should show only these changes: builder to NIXPACKS, plus the start command, health check path and health check timeout. `railway.json` already applies these on every deploy, so the running service doesn't change.
2. `railway config apply`.
3. Delete `railway.json` in a separate commit. The deploy after that uses the settings above.
4. `railway config plan` should now report no changes, and `railway config migrate status` should show no service reading Config as Code.
