# UI Porting Plan — old frontends → `my/spaces/*`

Execution plan for moving each legacy service frontend into the `my` portal. Companion to `INFRA.md` §0 — this is the zoom-in.

Legend: `[x]` done · `[~]` in progress · `[ ]` pending · `[!]` blocked

---

## Source inventory (what exists today)

### `api/accounts/frontend/src/views/` — 16 views
Appearance, ForgotPassword, Home, Login, Notifications, Passkeys, Password, Privacy, Profile, Register, ResetPassword, Security, Services, Sessions, TwoFactor, Verify2FA.

*Auth pages (Login, Register, Forgot, Reset, TwoFactor, Verify2FA) — already rebuilt in `my/core/src/views/*.Vue`. Not re-ported.*

### `api/developer/frontend/src/pages/author/` — 11 pages
Dashboard, Profile, Spaces, SpaceDetail, Publish, Review, Keys, Data, Transfers, Playground, Docs (+ `docs/` sub-pages: Brain, Manifest, DataQueries, …).

### `api/graph/frontend/src/pages/` (paas-console) — 7 pages
Overview, Spaces, SpaceDetail, Schemas, SchemaDetail, ModelDetail, Usage, Playground.

**Graph UI consolidates into the developer space** (per the Firebase-console decision — `map.html` §3). No standalone graph space.

---

## Target: three spaces in `my/spaces/`

| Space | Status | Scope |
|---|---|---|
| `account` | `[~]` half-done (Appearance ported; 7 placeholders) | Profile, security, prefs — per-user settings |
| `developer` | `[ ]` not started | Publisher, spaces, schemas, data, usage, keys, transfers |
| `org` | `[ ]` not started | Organizations, members, projects, invites |

---

## 1 · `account` space — finish the port

### Pages to complete in `my/spaces/account/src/pages/settings/`

| Page | Source | Endpoints | Complexity |
|---|---|---|---|
| Overview | `accounts/frontend/views/Profile.vue` | `GET /api/accounts/me` | S |
| Appearance | — (done) `[x]` | — | — |
| Password | `accounts/.../Password.vue` | `POST /api/auth/password` | S |
| Notifications | `accounts/.../Notifications.vue` | `GET/PUT /api/preferences/notifications` | S |
| Services | `accounts/.../Services.vue` | `GET /api/services`, `DELETE /api/services/{client_id}` | S |
| Privacy | `accounts/.../Privacy.vue` | `GET /api/account/export`, `POST /api/account/delete` | M (irreversible action) |
| Sessions | `accounts/.../Sessions.vue` | `GET /api/auth/sessions`, `DELETE /api/auth/sessions/{id}` | S |
| Two-Factor | `accounts/.../TwoFactor.vue` | `POST /api/2fa/{setup,verify,disable}` | M (QR code, recovery codes) |
| Passkeys | `accounts/.../Passkeys.vue` | `GET /api/passkeys`, `POST /api/passkey/register/{begin,finish}`, `DELETE /api/passkey/{id}` | M (WebAuthn ceremony) |

### Shared composable
Extract `my/core/src/composables/useAccountsAPI.ts` with typed helpers — every page calls the same 6-10 endpoints and we don't want to re-write `fetch` boilerplate nine times.

### Gateway routes needed
All already covered by the existing `/api/accounts/*` block — no nginx changes.

### Order
1. **Password + Sessions** first — small, same pattern as Login.vue, de-risks the composable shape.
2. **Overview + Notifications + Services** — basic CRUD.
3. **Privacy** — review the data-export flow (delivery method? email? direct download?).
4. **Two-Factor** — QR code rendering + recovery codes.
5. **Passkeys** — already have the primitives from `useAuth.ts::loginWithPasskey`; extract + reuse.

**Acceptance**: every Password/2FA/Passkey/Session flow works end-to-end from `my.lisaos.dev` without touching any legacy accounts page.

---

## 2 · `developer` space — net new

Scaffold `my/spaces/developer/` (mirror `my/spaces/account/` structure: `package.json`, `src/index.ts` exporting an `InfraSpace`, `src/Dispatcher.vue`, `src/pages/*`).

### Sections (in the sub-nav)

| Section | Pages | Source | Endpoints |
|---|---|---|---|
| **PUBLISHER** | Profile, Keys | `developer/frontend/pages/author/Profile.vue`, `KeysPage.vue` | `GET /api/developer/publisher`, `POST /api/developer/publishers/regenerate-key` |
| **SPACES** | Spaces list, SpaceDetail, Publish | `developer/.../{Spaces,SpaceDetail,Publish}Page.vue` | `GET /api/developer/spaces/mine`, `GET /api/developer/spaces/{name}`, `POST /api/developer/publish` |
| **DATA** | Schemas (per-space), ModelDetail, Playground | `graph/frontend/pages/{Schemas,SchemaDetail,ModelDetail,Playground}Page.vue` | `GET /api/developer/schemas/{spaceId}` (façade), graph `/graphql` for Playground |
| **USAGE** | Overview, Usage | `graph/frontend/pages/{Overview,Usage}Page.vue` | `GET /api/developer/stats` (façade, still to be built) |
| **TRANSFERS** | Incoming, Outgoing | `developer/.../TransfersPage.vue` | `GET /api/developer/transfers/{incoming,outgoing}`, `POST /api/developer/transfers/{id}/{accept,decline}` |
| **REVIEW** (admin-only) | Review queue | `developer/.../ReviewPage.vue` | `GET /api/developer/admin/spaces/pending-review` |

### Backend work needed in `developer` service
- [x] `/api/schemas/register`, `/api/schemas/{spaceId}`, `/api/schemas/{spaceId}` DELETE (already shipped in `f2f56d0` as graph façade).
- [ ] `/api/schemas/{spaceId}/models/{name}` — model detail (proxies to graph).
- [ ] `/api/data/stats` — usage numbers (proxies to graph + aggregates).
- [ ] `/api/spaces/{name}/schema` (alias for the /api/schemas/* path — more RESTful under a space). Optional.

### Graph work (locking down public surface)
- [ ] Graph's `/api/schemas/*` and `/api/admin/*` become internal-only. Check `X-Internal-Secret` (allow) or reject public calls.
- [ ] `/graphql` stays public with CORS for space runtime origins.
- [ ] Playground page in my points at `/api/developer/graphql/proxy` (or similar) for authed GraphQL — so the browser doesn't hit graph.c.s directly with the user's session cookie.

### Order
1. **Scaffold space** + Publisher → Profile page (smallest). Validates the space-package pattern for a new space.
2. **Spaces list + SpaceDetail** — core CRUD on developer's existing endpoints.
3. **Schemas** (uses the façade we already shipped).
4. **Publish** — the real value add.
5. **Data / Models / Playground** — likely the most work (custom table rendering, code-mirror for playground).
6. **Transfers** — small, well-defined.
7. **Review** — admin-only, gated behind a role check.

**Acceptance**: `construct graph push` from CLI + publishing a space + browsing its schemas/data all work through `my.lisaos.dev`. No user visits `developer.lisaos.dev` in the browser.

---

## 3 · `org` space — net new

Scaffold `my/spaces/org/`. Only visible when the user's scope is `org`.

### Sections

| Section | Pages | Source | Endpoints |
|---|---|---|---|
| **OVERVIEW** | Org summary | — (new) | `GET /api/source/org` |
| **MEMBERS** | List, Invite, Roles | — (new; source has endpoints) | `GET /api/source/org/members`, `POST /api/source/org/invites`, `PUT /api/source/org/members/{id}/role` |
| **PROJECTS** | List, Detail | — (new) | `GET /api/source/projects`, `GET /api/source/projects/{id}` |
| **ROLES** | Role definitions | — (new) | `GET/PUT /api/source/org/roles` |
| **BILLING** | Plan, usage | — (new; might integrate `billing` service) | TBD |

Source currently has no frontend — all these pages are greenfield UI on existing JSON endpoints.

### Order
1. **Overview** + **Members** list (read-only) — gets the space visible.
2. **Invite flow** (email + role), accept/decline endpoints already exist.
3. **Projects** read-only, then write.
4. **Roles** — read-only unless you're an owner.
5. **Billing** — defer until billing integration is scoped.

**Acceptance**: org owners manage their members + projects entirely from `my.lisaos.dev`. `source.lisaos.dev` only sees service-to-service traffic.

---

## 4 · Cross-cutting work

| Item | Notes |
|---|---|
| **SDK coverage** (`my/packages/infra-sdk/`) | Today only `accounts.scope()`. Grow `developer.*`, `source.*`, `accounts.*` to cover everything these spaces need. Header routing stays inside the SDK. |
| **Navigation** | Each space registers its `sections` in `InfraSpace`. Shell renders automatically. Nothing new. |
| **Capability gating** | Shell already filters spaces by `requires`. `developer` space: `requires: ['developer']`. `org`: `requires: ['scope:org']`. `account`: `requires: ['identity']`. |
| **Shared components** | Extract reusable bits as they appear (ConfirmDialog, CopyableCode, CodeBlock, EmptyState-with-CTA). Put in `packages/ui-web/src/components/` not `core/` so other spaces can use. |
| **Delete legacy frontends** | After each space reaches parity, `trash` the corresponding `api/<service>/frontend/` and `api/<service>/templates/` dirs. Services become pure APIs. |

---

## Order of operations (big picture)

```
Week-ish ▼               │ account │ developer │ org  │
─────────────────────────┼─────────┼───────────┼──────┤
Finish account port      │   ✓     │           │      │  1-2 weeks of real work across 7 pages
Scaffold developer space │         │   ✓       │      │  1 day
Publisher + Spaces       │         │   ✓       │      │  2-3 days
Schemas + Data           │         │   ✓       │      │  1 week (graph façade endpoints + UI)
Publish + Transfers      │         │   ✓       │      │  3 days
Scaffold org space       │         │           │  ✓   │  1 day
Members + Invites        │         │           │  ✓   │  3 days
Projects + Roles         │         │           │  ✓   │  3 days
Kill legacy frontends    │   ✓     │   ✓       │  ✓   │  1 day each, after space parity
```

Not hard deadlines — estimation shape for ordering, not commitments.

---

## Criteria to ship

A space is "done" when:
- Every page from the old frontend has an equivalent (or is explicitly deprecated).
- All flows work from `my.lisaos.dev` signed in as a real user.
- The underlying service's `frontend/` and `templates/` directories can be deleted without breaking anything.
- The public subdomain can go internal-only on CapRover.

---

## What NOT to port

- **Admin-only operator consoles** (if any) → these go into the separate `oracle` admin portal, not `my`.
- **CLI-specific UI** (the old developer `cli-verify` page) → CLI now uses OAuth via `my.lisaos.dev/api/oauth/*`. No UI needed.
- **OAuth callback HTML** (the consent page, code-display page) → already owned by `my/views/OAuthCallback.vue` and `Consent.vue`.
