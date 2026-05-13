# Per-routine Turso tokens

Each routine gets its own token with the minimum permissions it needs, bounding
blast radius if a routine prompt leaks. Set them up after `001_init.sql` has been applied.

## Issuance

After tables exist, issue scoped tokens. Turso scoping syntax depends on CLI
version — check `turso db tokens create --help`. The general approach:

### Ingest (write to jobs, scores, adapters, routine_runs)

```bash
turso db tokens create job-hunter --expiration none
# Capture as TURSO_AUTH_TOKEN_INGEST. Use the full token if table-scoped tokens
# aren't available in your CLI version.
```

### Backup (read-only)

```bash
turso db tokens create job-hunter --read-only --expiration none
# Capture as TURSO_AUTH_TOKEN_BACKUP
```

### Reconciler (writes to adapters + jobs.archived + routine_runs)

```bash
turso db tokens create job-hunter --expiration none
# Capture as TURSO_AUTH_TOKEN_RECONCILER
```

### Hub

The Hub uses `TURSO_AUTH_TOKEN_FULL` (already set in `.env` from setup).

## How to use

In each routine's secret env (set via /schedule when creating the routine),
use the appropriate token as `TURSO_AUTH_TOKEN`. The routine prompt references
`TURSO_AUTH_TOKEN` (generic name); the actual scope comes from the value configured
when deploying the routine.

## Rotation

To rotate: `turso db tokens invalidate <token-id>` (find IDs via
`turso db tokens list job-hunter`), then issue a new one and update the routine env.
