# Deploying to Railway from Replit

Notes on what breaks and how to fix it when porting a pnpm monorepo from Replit to Railway.

---

## Issues & Fixes

### 1. `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`

Railway runs `pnpm install --frozen-lockfile`. If the lockfile was generated on Replit with a different pnpm version, or with invalid workspace config, every build fails.

**Cause A — `allowBuilds` placeholder**

Replit adds `allowBuilds` to `pnpm-workspace.yaml` but leaves a placeholder string instead of a boolean. Remove it — `onlyBuiltDependencies` is the correct pnpm v9 equivalent.

```yaml
# pnpm-workspace.yaml — remove this:
allowBuilds:
  esbuild: true  # ← delete the whole block

# Keep this instead (pnpm v9 syntax):
onlyBuiltDependencies:
  - esbuild
  - '@swc/core'
```

**Cause B — Stale `overrides:` block in the lockfile**

Replit's pnpm version writes an `overrides:` block into `pnpm-lock.yaml`. Railway's pnpm 9.15.9 on Linux generates a lockfile without this block, so the two diverge.

**Fix:** Regenerate the lockfile using the exact pnpm version Railway uses. Check your build logs for `Done in Xs using pnpm vX.X.X` to confirm the version.

```bash
# Regenerate with Railway's pnpm version
npx pnpm@9.15.9 install --no-frozen-lockfile

# Verify frozen install passes before pushing
npx pnpm@9.15.9 install --frozen-lockfile
```

---

### 2. Railway skips rebuilds when only root files change

Railway's monorepo detector watches per-service directories. Pushing a change to `pnpm-lock.yaml` or `pnpm-workspace.yaml` at the repo root shows **SKIPPED** for every service — the new lockfile never gets used.

**Fix:** Add a `railway.toml` to each service directory that watches root-level files.

```toml
# artifacts/api-server/railway.toml  (repeat for every service)
[build]
watchPatterns = ["**", "../../pnpm-lock.yaml", "../../pnpm-workspace.yaml"]
```

> **Note:** `railway redeploy` re-runs the last built image, not the latest commit. A git push is more reliable for triggering full rebuilds.

---

### 3. `DATABASE_URL must be set` — service crashes on startup

Replit provisions databases and injects environment variables automatically. Railway does not.

**Fix:**

1. In Railway → your project → **+ New → Database → PostgreSQL**
2. Once it's online, go to each service that needs the database → **Variables**
3. Add a reference variable: `DATABASE_URL = ${{Postgres.DATABASE_URL}}`

Or via the Railway CLI:

```bash
railway service "@workspace/api-server"
railway variables set DATABASE_URL='${{Postgres.DATABASE_URL}}'
```

The `${{Postgres.DATABASE_URL}}` syntax is a Railway reference variable — it pulls the live value from the Postgres service so you never hardcode credentials.

---

## Pre-Deploy Checklist

- [ ] Check Railway build logs for the pnpm version (`using pnpm vX.X.X`) and use that exact version to regenerate the lockfile locally
- [ ] Remove any `allowBuilds` keys from `pnpm-workspace.yaml` — use `onlyBuiltDependencies` for pnpm v9
- [ ] Confirm `npx pnpm@9.15.9 install --frozen-lockfile` passes locally before pushing
- [ ] Add `railway.toml` with `watchPatterns` to every service directory
- [ ] Provision any required databases in Railway and set reference variables on each service
- [ ] Link the Railway CLI: `railway link --project <name>` to monitor deployments from the terminal

---

## Quick Reference

| Error / Symptom | Root Cause | Fix |
|---|---|---|
| `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH` | Lockfile generated with wrong pnpm version or invalid workspace config | Regenerate with `npx pnpm@9.15.9 install --no-frozen-lockfile` |
| All services show SKIPPED after push | Railway only watches service directories, not repo root | Add `railway.toml` with `watchPatterns` to each service |
| Service crashes: `DATABASE_URL must be set` | No database provisioned; Replit injects these automatically, Railway doesn't | Add Postgres in Railway, set `${{Postgres.DATABASE_URL}}` reference |
| `railway redeploy` doesn't pick up new code | Redeploy re-runs the last image, not the latest commit | Push a real code change or use `railway up` |
