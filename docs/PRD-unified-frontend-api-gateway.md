# PRD: Unified Frontend + API Gateway (`my.lisaos.dev`)

**Status**: Draft
**Date**: 2026-04-16
**Owner**: Flakerimi
**Scope**: Infra-wide (frontend + all Go services + CLI + desktop)

---

## 1. Summary

Replace the current constellation of public subdomains (`developer.lisaos.dev`, `accounts.lisaos.dev`, etc., each with its own frontend) with a **single public app at `my.lisaos.dev`** — one portal for end-users, one login, one URL. Backend services stay split (their own process, own DB, own CapRover app) but become **fully internal-only**. One nginx gateway bundled with the frontend proxies `/api/*` to the right service and centralizes auth. **Deployed on a brand-new Hetzner box with a fresh CapRover** — no in-place migration of the existing CONSTRUCT-MAIN cluster.

**Slogan**: *Centralized outside, decentralized inside.*

**Out of scope (separate project)**: `oracle` is the Construct admin portal (for Construct staff, not end-users). It follows the same gateway pattern but at its own domain (e.g., `admin.lisaos.dev`) on its own infra. Not addressed by this PRD.

---

## 2. Motivation

### Today's pain
- **Users see N subdomains**, each with its own UI, login box, and mental model.
- **CORS gauntlet**: frontend on one subdomain, API on another, auth cookies don't cross cleanly.
- **Each service re-validates tokens**, duplicating `pkg/auth`-ish code across repos.
- **Three client types** (web, CLI, desktop) each know multiple base URLs and must be kept in sync when one moves.
- **Four frontends to maintain** (accounts frontend, developer frontend, any-future frontend, construct-app) that largely duplicate layout chrome.

### After
- Users see **one URL**.
- **One TLS cert**, one CORS surface (none — same-origin), one set of logs.
- **One place** validates tokens (the gateway); services trust `X-Auth-*` headers.
- Web, CLI, desktop all hit `my.lisaos.dev/api/*` with identical contracts.
- One frontend codebase (`my/core` + spaces) replaces the per-subdomain frontends.

### Non-goals
- Not rewriting services into a monolith.
- Not replacing CapRover with Kubernetes.
- Not introducing GraphQL, Redis, CDN, managed LB — defer until a measured bottleneck demands it.
- Not changing token formats (`cat_*` identity, `csk_live_*` publisher ownership stay as-is).
- Not moving databases.

---

## 3. Target architecture

```
                  ┌─────────────────────────────────────────┐
  Browser  ───▶   │  my.lisaos.dev  (the ONLY public)  │
  CLI      ───▶   │  ┌────────────────────────────────────┐ │
  Desktop  ───▶   │  │  nginx gateway                      │ │
                  │  │  ┌────────────────────────────────┐ │ │
                  │  │  │  /  → Vue SPA (static)         │ │ │
                  │  │  │  /login, /consent → SPA routes │ │ │
                  │  │  │  /oauth/callback → SPA route   │ │ │
                  │  │  │  /api/* → auth check           │ │ │
                  │  │  │          → srv-captain--X      │ │ │
                  │  │  └────────────────────────────────┘ │ │
                  │  └────────────────────────────────────┘ │
                  └─────────────────────────────────────────┘
                              │
                              ▼  (Docker Swarm internal network)
        ┌────────────┬────────────┬────────────┬────────────┐
        │ accounts   │ developer  │  source    │  graph     │
        │ (internal) │ (internal) │ (internal) │ (internal) │
        │  its DB    │  its DB    │  its DB    │ graph-1 PG │
        └────────────┴────────────┴────────────┴────────────┘

        (oracle = separate admin portal project, not in this PRD)
```

### URL map

**Public** (there is only one public hostname)
| URL | Purpose |
|---|---|
| `my.lisaos.dev/` | Vue SPA (my/core) |
| `my.lisaos.dev/login` | login page (SPA route) |
| `my.lisaos.dev/consent` | OAuth consent screen (SPA route) |
| `my.lisaos.dev/oauth/callback` | OAuth redirect target for CLI/desktop loopback (SPA route) |
| `my.lisaos.dev/api/oauth/authorize` | OAuth 2.0 authorize — proxied → accounts `/oauth/authorize` |
| `my.lisaos.dev/api/oauth/token` | OAuth 2.0 token exchange — proxied → accounts `/oauth/token` |
| `my.lisaos.dev/api/oauth/revoke` | OAuth token revocation — proxied → accounts `/oauth/revoke` |
| `my.lisaos.dev/api/auth/login` | username/password login — proxied → accounts `/api/auth/login` |
| `my.lisaos.dev/api/auth/logout` | session termination — proxied → accounts `/api/auth/logout` |
| `my.lisaos.dev/api/auth/csrf` | CSRF token for SPA — proxied → accounts `/api/auth/csrf` |
| `my.lisaos.dev/api/accounts/*` | user profile / scope — proxied → accounts |
| `my.lisaos.dev/api/developer/*` | proxied → `srv-captain--developer` |
| `my.lisaos.dev/api/source/*` | proxied → `srv-captain--source` |
| `my.lisaos.dev/api/graph/*` | proxied → `srv-captain--graph` |

**Internal** (no public hostname, reachable only via `srv-captain--<name>` on CapRover overlay network)
- `srv-captain--accounts` — fully internal, no public surface
- `srv-captain--developer`
- `srv-captain--source`
- `srv-captain--graph`

The `accounts.lisaos.dev` hostname is **retired** post-cutover — all OAuth and login UX lives at `my.lisaos.dev`.

---

## 4. Auth

### Flow (web)
1. Browser hits `my.lisaos.dev/*`, no token → SPA redirects to `accounts.lisaos.dev/oauth/authorize?client_id=web&redirect_uri=https://my.lisaos.dev/oauth/callback&response_type=code`.
2. User logs in / consents on `accounts` (the only place with a login UI).
3. Accounts redirects to `my.lisaos.dev/oauth/callback?code=...`.
4. SPA exchanges code at `my.lisaos.dev/api/accounts/oauth/token` (proxied internally) → receives `cat_*` token.
5. Token stored in `localStorage`.
6. All subsequent calls: `Authorization: Bearer cat_*` to `/api/*`.

### Flow (CLI / desktop)
- Same OAuth dance, `redirect_uri=http://localhost:<ephemeral>/callback` (desktop/CLI spin up a loopback listener).
- Alternative: OAuth 2.0 device-code flow for headless CI (`construct login --device`).
- Token stored at `profiles/<activeId>/auth.json` (already the format per the 2026-04-13 work).

### Gateway validation (one place instead of N)
On every `/api/*` request the gateway:
1. Reads `Authorization: Bearer cat_*`.
2. Calls `srv-captain--accounts/internal/validate-token` (nginx `auth_request`) with `INTERNAL_SHARED_SECRET`.
3. On 200, reads response headers: `X-Auth-User-ID`, `X-Auth-User-Email`, `X-Auth-Org-ID`, `X-Auth-Roles`, `X-Auth-Publisher-ID` (if `csk_*` was supplied as `X-API-Key`).
4. Injects those headers onto the proxied upstream request.
5. On 401, returns 401 to the client — downstream never sees the request.

**Downstream services trust the `X-Auth-*` headers verbatim** (they can only come from the gateway; the gateway is the only thing with `INTERNAL_SHARED_SECRET` + network access). They no longer re-validate `Authorization` except when `X-Auth-*` is absent (dev mode, direct curl).

Shared library `pkg/auth` in Go (per the pending "Unify infra" item) implements this middleware once — every service adopts it.

### Token types
- `cat_*` — identity → `Authorization: Bearer` → validated by gateway via accounts.
- `csk_live_*` — publisher ownership → `X-API-Key` header → validated by accounts, gateway forwards as `X-Auth-Publisher-ID` when valid.
- Both may appear on one request: `AuthContext { identity, publisher? }`.

---

## 5. Gateway

### Technology
**nginx** deployed as its own CapRover app (`my` — the public my.lisaos.dev app). Config:
- Serves built Vue SPA static files.
- `location /api/accounts/` → `http://srv-captain--accounts/` with `auth_request` + header injection.
- Same pattern for `/api/developer/`, `/api/source/`, `/api/graph/`, `/api/oracle/`.
- Static 404 for any path that isn't `/`, `/oauth/callback`, or `/api/*` — the SPA handles routing client-side.

Rationale for nginx (not Caddy, not Go):
- CapRover already uses nginx; ops familiarity.
- `auth_request` module does what we need in ~10 lines.
- Zero new runtime; one Dockerfile.

### Example nginx skeleton
```nginx
# Static frontend
location / {
    root /usr/share/nginx/html;
    try_files $uri /index.html;
}

# Auth subrequest target (internal-only)
location = /_internal/auth {
    internal;
    proxy_pass http://srv-captain--accounts/internal/validate-token;
    proxy_pass_request_body off;
    proxy_set_header Content-Length "";
    proxy_set_header X-Original-URI $request_uri;
    proxy_set_header X-Internal-Secret $INTERNAL_SHARED_SECRET;
    proxy_set_header Authorization $http_authorization;
    proxy_set_header X-API-Key $http_x_api_key;
}

# Per-service proxy with auth + header injection
location /api/developer/ {
    auth_request /_internal/auth;
    auth_request_set $auth_user_id    $upstream_http_x_auth_user_id;
    auth_request_set $auth_user_email $upstream_http_x_auth_user_email;
    auth_request_set $auth_org_id     $upstream_http_x_auth_org_id;
    auth_request_set $auth_roles      $upstream_http_x_auth_roles;

    proxy_pass http://srv-captain--developer/;
    proxy_set_header X-Auth-User-ID    $auth_user_id;
    proxy_set_header X-Auth-User-Email $auth_user_email;
    proxy_set_header X-Auth-Org-ID     $auth_org_id;
    proxy_set_header X-Auth-Roles      $auth_roles;
    proxy_set_header X-Internal-Secret $INTERNAL_SHARED_SECRET;
}
```

### Error contract
- `401` — missing/invalid token (returned by auth_request).
- `502` — upstream service unreachable (nginx default, body rewritten to JSON `{error: "upstream_unavailable", service: "developer"}`).
- `504` — upstream timeout (default 30s per service).

### What the gateway **must not** do
- No business logic.
- No per-request DB calls.
- No query aggregation / GraphQL resolution.
- No response mutation beyond header stripping.
- No caching (for now — defer until metrics justify it).

The moment the gateway grows an endpoint of its own, revisit this PRD.

---

## 6. Accounts: split public surface

Accounts is the only service that keeps a public face, but only for OAuth. Inside the accounts app, nginx location rules expose only:
- `/oauth/authorize`
- `/oauth/token`
- `/oauth/jwks` (if JWKS published)
- `/login`
- `/consent`
- `/static/*` (login page assets)

Everything else (`/api/me/scope`, profile CRUD, session mgmt, `/internal/validate-token`) is **internal-only** — reachable only via `srv-captain--accounts` from the gateway.

Implementation options:
1. **Two HTTP listeners in the accounts Go binary**: public on `:80`, internal on `:8080`; CapRover forwards public only.
2. **One listener, nginx in front** within the accounts container filtering by path. (Simpler; no Go change.)

Recommendation: option 2 for the cutover, option 1 later if the routing grows.

---

## 7. Client changes

### 7.1 `my/core` (Vue SPA)
- Remove `VITE_ACCOUNTS_URL`, `VITE_DEVELOPER_URL`, `VITE_SOURCE_URL`, `VITE_GRAPH_URL`.
- SDK base URL becomes `''` (empty → relative → same-origin).
- Vite dev server: one proxy rule, `/api/*` → local dev stack (docker-compose; §10).
- Login flow: `SignIn.vue` becomes a redirect to `/api/accounts/oauth/authorize?...` (SPA never renders a login form — accounts owns that UI).
- Add `/oauth/callback` route in `core/src/routes.ts` that exchanges the `code` and stores the token.

### 7.2 `my/packages/infra-sdk`
- Single base URL constructor arg; default `''`.
- Keep per-service namespaces: `infra.accounts`, `infra.developer`, `infra.source`, `infra.graph`, `infra.oracle`.
- Token attach: `Authorization: Bearer ${token}` for identity; `X-API-Key: ${csk}` when publisher scope is needed.

### 7.3 `construct-cli`
- Change default base URL from `accounts.lisaos.dev` to `my.lisaos.dev/api`.
- Login command: opens browser to `my.lisaos.dev/api/accounts/oauth/authorize?client_id=cli&redirect_uri=http://127.0.0.1:<ephemeral>/cb&response_type=code` and catches the callback on localhost.
- Offer `--device` flag for device-code flow (headless CI).
- Token/profile storage unchanged: `profiles/<id>/auth.json`.

### 7.4 `construct-app` (desktop)
- Change default base URL to `my.lisaos.dev/api`.
- Tauri window opens `my.lisaos.dev/api/accounts/oauth/authorize` with a custom deep-link redirect (`construct://oauth/callback`), or loopback port (simpler first cut).
- Same token persistence; CLI and desktop share the file (already wired per memory).

---

## 8. Service changes

Each Go service gets a common middleware (`pkg/auth`, to be extracted from the copies in accounts/developer/source/graph/oracle):

```go
func AuthMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        ctx := r.Context()

        // Gateway-trusted path
        if r.Header.Get("X-Internal-Secret") == os.Getenv("INTERNAL_SHARED_SECRET") {
            ctx = auth.WithIdentity(ctx, auth.Identity{
                UserID:  r.Header.Get("X-Auth-User-ID"),
                Email:   r.Header.Get("X-Auth-User-Email"),
                OrgID:   r.Header.Get("X-Auth-Org-ID"),
                Roles:   strings.Split(r.Header.Get("X-Auth-Roles"), ","),
            })
            if pid := r.Header.Get("X-Auth-Publisher-ID"); pid != "" {
                ctx = auth.WithPublisher(ctx, auth.Publisher{ID: pid})
            }
            next.ServeHTTP(w, r.WithContext(ctx))
            return
        }

        // Fallback: validate Authorization directly (dev / direct curl)
        identity, err := auth.ValidateToken(r.Header.Get("Authorization"))
        if err != nil {
            http.Error(w, "unauthorized", 401)
            return
        }
        ctx = auth.WithIdentity(ctx, identity)
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}
```

### Per-service work
| Service | Changes |
|---|---|
| accounts | Add `/internal/validate-token` endpoint. Adopt `pkg/auth` middleware. Drop public HTML surface (login/consent become SPA routes). |
| developer | Adopt `pkg/auth` middleware. Remove its own copy. |
| source | Adopt `pkg/auth` middleware. Close the `X-Company-ID` trust loophole (done 2026-04-13, verify still in place). |
| graph | Adopt `pkg/auth` middleware. Keep `X-Auth-Org-ID` trusted only from gateway. |

Shared DB/table for tokens stays in accounts. Other services don't see tokens — only headers.

---

## 9. Deployment

### Current Hetzner inventory
All four boxes share the Hetzner Cloud private network `10.10.0.0/24`, region `eu-central` (Nuremberg + Falkenstein).

| Host | Type | Private IP | Public IP | Role |
|---|---|---|---|---|
| `CONSTRUCT-MAIN` | CAX41 (320 GB ARM) | 10.10.0.2 | 46.224.45.43 | existing CapRover — hosts accounts, developer, source, delivery-user, etc. |
| `BASEPOD-001` | CAX21 (80 GB ARM) | 10.10.0.3 | 23.88.112.108 | (existing, separate concern) |
| `delivery-1` | CAX11 (40 GB ARM) | 10.10.0.4 | 46.225.229.140 | ConstructDelivery (email) |
| `graph-1` | CAX11 (40 GB ARM) | 10.10.0.5 | — | PostgreSQL for graph service |

### New box: `my-1`
Spin up a **fresh Hetzner CAX11** (40 GB ARM, ~€5/month) in `eu-central`, attach to the same `10.10.0.0/24` network. Name: `my-1`. Role: dedicated CapRover host for the public gateway + Vue SPA.

Keeping it on its own box (not mixed into `CONSTRUCT-MAIN`) buys:
- **Clean rollback**: kill the box, nothing else breaks.
- **Independent TLS + public ingress**: the only box with `my.lisaos.dev` bound.
- **No risk to existing services** during the greenfield build-out.
- **Smaller attack surface** on `CONSTRUCT-MAIN`: existing services become internal-only and nothing on port 80/443 from the public internet.

### Cluster topology: two independent CapRovers (not a shared cluster)
Two options were considered:

| Option | Description | Verdict |
|---|---|---|
| **A. Join `my-1` as CapRover worker of `CONSTRUCT-MAIN`** | One cluster, `srv-captain--*` DNS spans both boxes, containers can schedule anywhere. | Rejected for now — couples deploys, a CapRover upgrade on the manager bounces the worker. |
| **B. `my-1` runs its own CapRover** | Gateway reaches services via private network IP `10.10.0.2` + port. | **Chosen.** Fully decoupled, simple mental model. |

With option B, `srv-captain--*` DNS doesn't work across boxes — so the gateway proxies to `http://10.10.0.2:<service-port>` instead. This requires each service on `CONSTRUCT-MAIN` to bind a port on the internal interface (not public). CapRover supports "Internal App" mode which exposes a container on the internal network only.

### CapRover apps (state after cutover)

**On `my-1` (new CapRover):**
| App | Public port | Public domain | Notes |
|---|---|---|---|
| `my` | 80/443 | `my.lisaos.dev` | nginx + SPA static build + gateway config |

**On `CONSTRUCT-MAIN` (existing CapRover):**
| App | Public port | Internal port | Notes |
|---|---|---|---|
| `accounts` | off | 80 | fully internal — was public; close it |
| `developer` | off | 80 | fully internal |
| `source` | off | 80 | fully internal |
| `graph` | off | 80 | fully internal |
| `delivery-user` | unchanged | — | email service, stays as-is |

Flip each existing app in CapRover UI → App Configs → "Do not expose as web-app" (internal-only mode). Internal port is reachable on the Hetzner private network at `10.10.0.2:<caprover-assigned-port>`.

### Cross-box networking
The gateway on `my-1` reaches services on `CONSTRUCT-MAIN`:
```
Browser → my.lisaos.dev (my-1 public)
       → nginx
       → http://10.10.0.2:<port>  (Hetzner private network, not internet)
       → service on CONSTRUCT-MAIN
```

Hetzner's private network is free-tier, gigabit, no egress fees. Latency Nuremberg→Falkenstein ≈ 5-10ms — negligible.

### Env vars
- `INTERNAL_SHARED_SECRET` — generated once, set on: `my` (gateway on `my-1`), `accounts`, `developer`, `source`, `graph` (all on `CONSTRUCT-MAIN`). All five use the same value.
- `PUBLIC_URL=https://my.lisaos.dev` — set on `my`, baked into SPA at build time as `VITE_PUBLIC_URL`.
- Per-service upstream URLs on `my`: `ACCOUNTS_UPSTREAM=http://10.10.0.2:<port>` etc. (One per proxied service — four in total.)

Drop from all clients: `VITE_ACCOUNTS_URL`, `VITE_DEVELOPER_URL`, `VITE_SOURCE_URL`, `VITE_GRAPH_URL`, `ACCOUNTS_OAUTH_URL`.

### DNS
- `my.lisaos.dev` — A record to `my-1` public IP. (New.)
- `accounts.lisaos.dev` — **removed from DNS** after phase 6. No public hostname remains.
- `developer.lisaos.dev`, `source.lisaos.dev`, `graph.lisaos.dev` — **removed from DNS** after phase 6 + 30-day grace.
- Existing mail-related records (`delivery-1`, MX, SPF, DKIM, DMARC) unchanged.

---

## 10. Local dev

Goal: one `bun run dev` at `my/` spins up the whole thing.

### Option A (recommended): docker-compose for Go services, Vite dev for SPA
- `my/docker-compose.dev.yml` runs postgres (graph's DB), accounts, developer, source, graph, oracle with hot reload (or prebuilt images).
- A local nginx container mimics the gateway at `localhost:8080`.
- Vite dev server runs `my/core` at `localhost:60200`, with Vite's proxy routing `/api/*` to `localhost:8080` (the local gateway).
- Frontend hot-reloads via Vite; Go services rebuild via `air`/equivalent.

### Option B: pure Vite proxy to remote dev/staging
- Vite's `/api/*` proxies directly to `my-staging.lisaos.dev/api/*`.
- No local Go running.
- Fast for frontend-only work; insufficient for backend changes.

Ship both — A is documented in `my/README.md`, B is the default out-of-the-box.

---

## 11. Migration plan (phased)

Every phase ends in a reversible state. Do not start phase N+1 until N is green.

### Phase 0 — Prep (this week)
- [ ] PRD signed off (this document).
- [ ] Inventory all current usages of per-service URLs in `my/core`, `construct-cli`, `construct-app/frontend`, `construct-app/operator`. One grep pass per repo, drop results into `docs/cutover-inventory.md`.
- [ ] Generate `INTERNAL_SHARED_SECRET`; store in a password manager shared between maintainers.
- [ ] Pick nginx base image + pin version.

### Phase 1 — Gateway skeleton (1–2 days)
- [ ] New CapRover app `my` with nginx:alpine + a dummy `index.html`.
- [ ] Wire DNS for `my.lisaos.dev`, issue TLS via CapRover.
- [ ] Smoke test: `curl https://my.lisaos.dev/` returns the dummy page.
- [ ] Commit gateway Dockerfile + nginx.conf to `my/deploy/gateway/`.

### Phase 2 — Auth plumbing (2–3 days)
- [ ] Add `GET /internal/validate-token` to accounts. Inputs: `Authorization` or `X-API-Key` + `X-Internal-Secret` header. Output: 200 with `X-Auth-*` headers on success, 401 otherwise.
- [ ] Extract `pkg/auth` Go module from accounts (or create in a shared infra repo); import into accounts initially.
- [ ] Add `auth_request` + header injection to gateway nginx config for `/api/accounts/*` as the first route.
- [ ] Test: `curl -H 'Authorization: Bearer cat_test' https://my.lisaos.dev/api/accounts/me/scope` round-trips.

### Phase 3 — Service routing (1 day per service)
For each of `developer`, `source`, `graph`:
- [ ] Add `pkg/auth` middleware to the service; accept `X-Auth-*` headers from gateway.
- [ ] Keep `Authorization: Bearer` fallback for direct/dev access.
- [ ] Add `location /api/<name>/` to gateway nginx.
- [ ] Integration test: call through gateway + call directly, both work.

### Phase 4 — Frontend cutover (2–3 days)
- [ ] Build `my/core` production bundle; copy into `my` gateway Docker image.
- [ ] Rewrite SPA API calls to use relative `/api/*`.
- [ ] Implement `/oauth/callback` route; remove any local `SignIn` form.
- [ ] Smoke test end-to-end login → scope fetch → renders.

### Phase 5 — CLI + desktop (parallel to 4)
- [ ] New CLI release with `my.lisaos.dev/api` default base.
- [ ] New desktop release with same.
- [ ] Both tolerate the old base URL via env override for rollback.

### Phase 6 — Internal lockdown (1 day)
- [ ] CapRover: flip `developer`, `source`, `graph`, `oracle` to internal-only.
- [ ] CapRover: configure `accounts` to expose only `/oauth/*`, `/login`, `/consent` publicly.
- [ ] Verify public `curl` to the old subdomains now 404s / unreachable.
- [ ] Verify all clients still work via `my.lisaos.dev`.

### Phase 7 — Cleanup (async, 2 weeks)
- [ ] Remove unused per-subdomain frontends (`api/accounts/frontend`, any others).
- [ ] Remove stale env vars from all services.
- [ ] Drop old DNS records.
- [ ] Update all READMEs.

---

## 12. Testing strategy

### Per-phase smoke
Each phase ships with a `./scripts/smoke-<phase>.sh` that curls the expected endpoints and asserts HTTP codes. These stay in the repo as regression tests.

### End-to-end
- **Web**: Playwright script — visit `my.lisaos.dev`, click Login, paste test-token on the accounts mock OAuth page, assert landed on `/` with scope loaded. (Deferred; nice-to-have.)
- **CLI**: shell-based integration — `construct login --url=my-staging.lisaos.dev`, `construct org status`, assert output.
- **Desktop**: manual for the first release; automate later.

### Load (cheap)
- `hey -n 10000 -c 50 https://my-staging.lisaos.dev/api/accounts/me/scope` with a valid token. Expect p95 < 300ms; if worse, the gateway/auth_request loop is the suspect.

### Fault injection
- Kill each internal service one at a time. Expect:
  - Gateway returns structured 502.
  - Other services keep working.
  - Frontend shows a non-catastrophic "service unavailable" toast (not a white screen).

---

## 13. Rollback

Rollback is cheap because nothing is destroyed during cutover — old subdomains remain live until phase 7.

- **Phase 4 fails** (frontend broken): revert `my.lisaos.dev` to maintenance page; users go back to old subdomains.
- **Phase 6 fails** (internal lockdown breaks something): flip services back to public via CapRover UI (60 seconds).
- **Auth-validation loop broken**: temporarily replace gateway's `auth_request` with a pass-through; services fall back to validating `Authorization` themselves.

Max rollback window: ~5 minutes for a CapRover flip, ~10 minutes for a DNS revert.

---

## 14. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Gateway becomes a single point of failure | All clients down | CapRover replicas (set `Instance Count = 2`) once stable. |
| `auth_request` adds latency to every call | p95 up | Accounts keeps a short-TTL in-memory cache of validated tokens (e.g., 60s). |
| `INTERNAL_SHARED_SECRET` leaks | Bypass auth | Rotate quarterly. Only in CapRover env vars, never committed. |
| Service forgets to trust `X-Auth-*` | 500s post-cutover | `pkg/auth` is a shared lib; one PR template per service. Smoke tests catch regressions. |
| OAuth redirect URI mismatch | Users can't log in | Register `my.lisaos.dev/oauth/callback` on accounts before phase 4. |
| CLI/desktop stuck on old URL | Can't reach API | Ship `--api-url` override flag so users can work around it; embed a staged default. |

---

## 15. Open questions

- [ ] **WebSockets / SSE** — does any service push live updates (oracle tailing, graph subscriptions)? If yes, nginx needs `proxy_set_header Upgrade` blocks. Inventory before phase 3.
- [ ] **OAuth for CLI**: device-code vs loopback redirect? Loopback is simpler; device-code is needed for headless CI. Ship loopback first, device-code as follow-up.
- [ ] **Rate limiting**: per-IP at gateway (nginx `limit_req`) now, or defer? Recommend defer until abuse observed.
- [ ] **Logs**: gateway access log to stdout → CapRover log aggregation? Or ship to a separate sink (Grafana Loki, Papertrail)? Defer decision — stdout is fine for now.
- [ ] **Gateway config management**: nginx.conf in `my/deploy/gateway/` (git) — how is it reloaded? CapRover rebuild, or volume + `nginx -s reload`? Rebuild is simpler; use it.
- [ ] **Public OAuth URL rebranding**: do we eventually want to serve OAuth from `my.lisaos.dev/oauth/*` too, killing the `accounts.lisaos.dev` public surface entirely? Possible — but out of this PRD. File follow-up.

---

## 16. Success metrics

Pass/fail after phase 6:
- [ ] One public domain in DNS for the user-facing app.
- [ ] Zero CORS failures in browser console during normal usage.
- [ ] Each service has `pkg/auth` imported; no duplicated validator code.
- [ ] CLI `construct whoami` works end-to-end via `my.lisaos.dev/api`.
- [ ] Desktop app logs in end-to-end via `my.lisaos.dev/api`.
- [ ] p95 latency for `GET /api/accounts/me/scope` ≤ 200ms (gateway + accounts combined).
- [ ] Old subdomains 404 or removed from DNS.

---

## 17. Out-of-scope follow-ups

Tracked but not part of this PRD:
- Introduce session-refresh flow (sliding-window tokens).
- Observability stack (metrics, traces).
- Rate limiting + abuse detection.
- Multi-region failover.
- GraphQL federation (unlikely — only if cross-service joins become routine).

---

## 18. Fresh-box leverage (decisions we'd regret not making now)

Greenfield deploys only happen every few years. These are worth doing **while** we're building `my-1`, not "someday":

### 18.1 `pkg/auth` as a real Go module from day one
- Create a new repo (or a monorepo dir) `construct-go-shared/auth/` with `go.mod`.
- All services import it: `import "github.com/construct-space/construct-go-shared/auth"`.
- Provides: `AuthMiddleware`, `Identity`, `Publisher`, `WithIdentity(ctx)`, `FromContext(ctx)`, `ValidateToken(authHeader)`.
- Never copy validation code into a service again. Every service gets the **same** token parsing, the **same** header trust logic, the **same** bug fixes.
- Acceptance: after Phase 3, `grep -rn "func validateToken" api/{accounts,developer,source,graph}` returns zero.

### 18.2 Structured JSON logs from day one
- Every service logs to **stdout only**, in JSON:
  ```json
  {"ts":"2026-04-16T18:00:00Z","level":"info","service":"developer","method":"GET","path":"/publishers","user_id":"cat_...","status":200,"duration_ms":34}
  ```
- Go: `slog.New(slog.NewJSONHandler(os.Stdout, …))`. One initializer in `pkg/log`.
- Every request has a `request_id` propagated via `X-Request-ID` (gateway generates it; services log it).
- Acceptance: any service's log line is parseable as JSON and contains `service`, `ts`, `level`, `request_id`.
- Ship to Loki/Grafana later — stdout + `docker logs` is fine until it isn't.

### 18.3 Per-service backups wired before anyone depends on the data
- **Postgres** (graph, and any service that adopts PG): daily `pg_dump | gzip | rclone copyto :s3:construct-backups/<service>/YYYY-MM-DD.sql.gz`, retention 30 days. One `cron` container per PG instance, or host-level crontab.
- **SQLite** (if any): Litestream streaming to Hetzner Storage Box (~€3/mo for 100GB).
- Weekly restore drill into a throwaway container. If you're not restoring, you don't have backups.
- Acceptance: every DB has a `./backup.sh` alongside its service, and one documented restore path.

### 18.4 CI builds Docker images, CapRover pulls tags
- Current: `caprover deploy` pushes source from a git checkout. No audit trail of what's running.
- New: GitHub Actions on tag push → build multi-arch Docker image (`linux/arm64` since Hetzner CAX is ARM) → push to `ghcr.io/construct-space/<service>:v1.2.3` → CapRover pulls by tag.
- CapRover UI then just points at an image tag; deploys are "change tag, click deploy".
- Rollback = redeploy previous tag. Currently rollback means git revert + re-deploy.
- Acceptance: `docker inspect` on a running container shows an image with a version tag, not `latest`.

### 18.5 Pinned base images + multi-stage Dockerfiles
- Pin Go version, Alpine version, distroless base. No `FROM golang:latest`.
- Multi-stage build: compile in `golang:1.23-alpine`, final stage in `gcr.io/distroless/static-debian12:nonroot`.
- ARM64 explicit (`--platform=linux/arm64`). Hetzner CAX is ARM.
- Acceptance: every Dockerfile has versioned base images and a final stage that does not include a shell.

### 18.6 `docker-compose.yml` for local dev, parity with prod
- `my/docker-compose.dev.yml` spins up: postgres, accounts, developer, source, graph, gateway nginx.
- Services run from the **same Dockerfile** as prod (no dev-only setup drift).
- Developer runs `docker compose up` in `my/`, then `bun run dev` in `my/core/`. One command each.
- Acceptance: `docker compose up` on a fresh clone brings up a working stack.

### 18.7 Single source of truth for service config
- Each service has a `config.yaml` (or env-only; pick one and commit to it).
- Shared schema via `pkg/config` — services don't parse env vars ad-hoc.
- Startup fails loudly if required config is missing. No silent defaults that bite later.

### 18.8 Health + readiness endpoints standardized
- Every service exposes:
  - `GET /healthz` — 200 if process alive (always works).
  - `GET /readyz` — 200 if DB reachable + migrations applied + dependent services healthy.
- Gateway's `502` handling can special-case unreadiness: `{error: "service_starting", service: "developer"}`.
- CapRover uses `/healthz` as the health-check URL. Pre-deploy gate via `/readyz`.

### 18.9 Migrations as code, not as "run this SQL"
- `golang-migrate` or `atlas` per service. Migrations live in `./migrations/*.sql`, versioned.
- Service binary runs migrations on startup (if lock acquired) — no manual DBA dance.
- Acceptance: deleting and recreating a DB + starting the service results in a schema identical to prod.

### What this doesn't include
- Metrics/tracing (Prometheus, OpenTelemetry) — defer until the log volume makes us want them.
- Service mesh — you're on one box, this would be satire.
- K8s — same.

**Implementation order**: 18.1 + 18.2 + 18.8 first (unblock everything else). 18.4 + 18.5 during the first service cutover. 18.3 + 18.9 before anyone trusts the DB with data. 18.6 + 18.7 as quality-of-life wins along the way.
