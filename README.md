# `my.lisaos.dev` — Construct unified portal

Single public entry point for Construct end-users:

- **Vue SPA** served at `/` (built from `core/` + `packages/` + `spaces/`).
- **`/api/*` reverse proxy** to internal Go services on the Hetzner private
  network. Token validation happens once via nginx `auth_request` →
  accounts' `/internal/validate-token`; `X-Auth-*` headers injected on
  the upstream request so services trust the gateway instead of re-decoding.

See [`docs/PRD-unified-frontend-api-gateway.md`](docs/PRD-unified-frontend-api-gateway.md) for the full architecture.

### Graph routes proxied under `/api/graph/*`

The graph service exposes publisher-facing endpoints the SPA can call through this gateway. Upstream paths are identical — `/api/graph/*` is rewritten to `/api/*` on the way through:

| Path | Purpose |
|---|---|
| `GET /api/graph/api/spaces` | List spaces owned by caller's org (table for the publisher dashboard) |
| `POST/GET /api/graph/api/space-bundles` | Create + list bundles (publisher grouping: kanban + kanban-admin) |
| `GET /api/graph/api/space-bundles/{id}` | Single bundle detail |
| `POST/DELETE /api/graph/api/spaces/{id}/install` | Tenant install / uninstall |
| `GET /api/graph/api/spaces/{id}/installs` | Publisher lists installers (gated to publisher org) |
| `PUT /api/graph/api/spaces/{id}/distribution` | `public` / `org_allowlist` / `private` |
| `POST/DELETE /api/graph/api/spaces/{id}/allowlist` | Allowlist mutation |

All of these require an `X-Auth-Org-ID` header, which the gateway injects from the session's `/me/scope` lookup — no client-supplied org overrides allowed.

Publisher-dashboard UI (bundles list, distribution editor, installs panel) is pending; today these routes are reachable via the `construct graph …` CLI commands (see `packages/construct-cli/README.md`).

## Layout

| File / dir | Purpose |
|---|---|
| `Dockerfile` | 2-stage build: Bun builds the SPA → nginx serves it + proxies |
| `captain-definition` | CapRover descriptor, points at `./Dockerfile` |
| `nginx.conf.template` | Server block with SPA + `/api/*` routes, rendered at container start via envsubst |
| `snippets/auth-inject.conf` | `auth_request_set $auth_*` variable captures |
| `snippets/upstream-headers.conf` | `X-Auth-*` + `X-Internal-Secret` headers added to every proxied request |
| `entrypoint.sh` | Validates required env vars, renders template, `nginx -t`, exec nginx |
| `core/` | Vue 3 SPA (Vite) |
| `packages/` | Workspace: `infra-sdk`, `infra-shell`, `ui-web` |
| `spaces/` | First-party spaces (currently: `account`) |
| `docs/` | Architecture + PRDs |

## Required environment variables

Set in CapRover → `my` app → App Configs:

| Var | Example | Notes |
|---|---|---|
| `INTERNAL_SHARED_SECRET` | `k9s-<random-128-bit-hex>` | Also set on every downstream service. Rotate quarterly. |
| `ACCOUNTS_UPSTREAM`      | `http://10.10.0.2:8081` | accounts service on CONSTRUCT-MAIN private IP |
| `DEVELOPER_UPSTREAM`     | `http://10.10.0.2:8082` | developer service |
| `SOURCE_UPSTREAM`        | `http://10.10.0.2:8083` | source service |
| `GRAPH_UPSTREAM`         | `http://10.10.0.2:8084` | graph service |

Port numbers are whatever CapRover assigns when each service is flipped
to "Internal App" mode. Check each app's CapRover page for its internal
container port + override with the right IP/port combo.

## Local build sanity-check

```bash
cd my
docker build -t construct-gateway:dev .
docker run --rm -p 8080:80 \
    -e INTERNAL_SHARED_SECRET=dev-secret \
    -e ACCOUNTS_UPSTREAM=http://host.docker.internal:8081 \
    -e DEVELOPER_UPSTREAM=http://host.docker.internal:8082 \
    -e SOURCE_UPSTREAM=http://host.docker.internal:8083 \
    -e GRAPH_UPSTREAM=http://host.docker.internal:8084 \
    construct-gateway:dev
```

Then `curl http://localhost:8080/` → SPA index.html.

`curl -H 'Authorization: Bearer cat_fake' http://localhost:8080/api/accounts/me/scope`
→ 502 (upstream unavailable) or 401 (if upstream is up and rejects the token),
not 500. Either is correct gateway behavior; the specific code depends on
whether the accounts upstream is reachable.

## Deploy

```bash
# From my/ root (one-liner deploy):
caprover deploy --caproverApp my --default

# Or: CI builds + pushes, CapRover pulls by tag (PRD §18.4)
docker build -t ghcr.io/construct-space/gateway:v0.1.0 .
docker push ghcr.io/construct-space/gateway:v0.1.0
# Then set image tag in CapRover UI.
```

## What the gateway does NOT do

- No caching (PRD §5 — defer until metrics justify it).
- No rate limiting (defer; see §15 open questions).
- No business logic.
- No cross-service aggregation.

If you're about to add one of these to nginx.conf, re-read the PRD.
