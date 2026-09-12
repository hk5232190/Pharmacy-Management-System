# Pharmacy Management System Architecture

## System context

PMS is a single-machine desktop application. A Tauri host launches a bundled
FastAPI process and renders a statically exported Next.js application. The UI
discovers the sidecar's loopback port at runtime and communicates through JSON
HTTP. FastAPI persists operational data in SQLite and stores files such as
licenses, uploads, logs, and backups on the local filesystem.

```text
User
  -> Tauri/WebView2 (window, installer, sidecar lifecycle)
     -> Next.js/React static UI (screens and client state)
        -> HTTP client / raw fetch calls
           -> FastAPI routers and dependencies
              -> route-level business logic
                 -> SQLAlchemy ORM -> SQLite
                 -> filesystem -> licenses/uploads/backups/logs/spooler
                 -> OS integrations -> printers/dialogs/processes
```

The deployment topology is appropriate for an offline, single-workstation
pharmacy. It is not currently a client/server multi-tenant architecture.

## Runtime data flow

1. Tauri starts the Python sidecar and reads `PMS_PORT:<port>` from stdout.
2. The frontend polls the Tauri command and caches the resolved API base URL.
3. `StartupProvider` checks the device license, then checks the stored bearer
   token and selects the initial route.
4. Feature pages call FastAPI, mostly through direct `fetch`; a smaller subset
   uses the shared API client.
5. Authentication dependencies decode the JWT and load the active user.
6. Route handlers query and mutate SQLAlchemy models, commit transactions, and
   format response payloads.
7. Sales/purchases update invoices, stock batches, balances, returns, and audit
   records. Reports aggregate those transactional tables.
8. Backup, license, printing, update, and diagnostics routes cross the OS and
   filesystem boundary.
9. The NSIS installer replaces binaries under Program Files; mutable user data
   must remain outside the installation directory.

## Current module responsibilities

| Area | Current implementation | Intended boundary |
|---|---|---|
| Desktop host | `frontend/src-tauri` | Window and sidecar lifecycle only |
| Presentation | `frontend/src/app`, components | Render state and collect input |
| Client state | React contexts/hooks | Session and cross-screen UI state |
| HTTP transport | `frontend/src/lib/api-client.ts` plus raw fetch | One typed transport boundary |
| API composition | `backend/api/router.py` | Prefix/tag registration only |
| HTTP endpoints | `backend/api/v1` | Validate/translate request and response |
| Domain workflows | Mostly embedded in route files | Application services/use cases |
| Persistence | `models.py`, `database.py` | Repositories/unit of work |
| Infrastructure | backup/license/printer helpers | Explicit filesystem and OS adapters |
| Schema evolution | Alembic plus startup SQL/scripts | Alembic only |

## Critical problem areas

### 1. Route handlers are the business layer

The backend has roughly 160 endpoints. Large route modules perform validation,
pricing, stock allocation, transaction control, serialization, audit logging,
file access, and printing together. This makes workflows hard to test without
HTTP and makes transaction boundaries difficult to review.

Target: thin routers calling application services. A sale service should own a
single transaction and return a domain result; the router should only translate
that result to the established response schema.

### 2. Frontend feature pages are monoliths

Reports, inventory, sales, and purchases each exceed roughly 1,900 lines. They
mix API calls, calculations, form state, tables, dialogs, exports, printing, and
layout. Any change has a large regression surface and triggers broad renders.

Target: feature folders with a typed API module, query/state hook, domain
utilities, and small presentation components. Preserve route URLs and payloads.

### 3. The transport abstraction is bypassed

There are more than 80 direct `fetch` call sites while a shared API client also
exists. Token injection, 401 handling, base URL resolution, cache policy, error
normalization, and response typing therefore vary by screen. Some modules bind
the synchronous API URL at module import time, before Tauri port discovery.

Target: one asynchronous transport with typed request/response contracts,
central cancellation/timeouts, and explicit public/authenticated calls.

### 4. Schema ownership is split

Alembic migrations coexist with startup `PRAGMA`/`ALTER TABLE` statements and
standalone migration scripts. A database can report one Alembic revision while
having a different physical schema. Startup also performs schema work on the
request-serving process.

Target: one linear, tested Alembic history. Migrate before accepting requests,
back up before migration, and remove inline DDL only after upgrade tests cover
every supported historical database.

### 5. Query cost grows with history

Several report/export endpoints load complete sales, purchase, batch, medicine,
and backup-history result sets into memory. Sales history also queries returns
inside a loop, producing N+1 round trips. SQLite can support this desktop scale,
but latency and memory use will grow with years of transaction history.

Target: mandatory bounded pagination for interactive endpoints, eager/batched
relationship loading, SQL aggregation instead of Python aggregation, streaming
exports, and indexes derived from measured query plans.

### 6. Concurrency semantics are implicit

The application uses SQLite with a threaded HTTP server and background backup.
`check_same_thread=False` permits access but does not define writer contention,
busy timeouts, WAL/checkpoint policy, or snapshot expectations. Row locking
calls such as `FOR UPDATE` do not provide PostgreSQL-style behavior in SQLite.

Target: keep one short transaction per command, configure SQLite pragmas
deliberately, serialize stock-changing commands where necessary, and load-test
simultaneous sale/return/backup operations. Move to a server database only if
multi-workstation deployment becomes a product requirement.

### 7. Infrastructure concerns leak into API modules

Backup and settings endpoints directly invoke subprocesses, dialogs, printers,
filesystem operations, hashing, compression, and database restoration. These
operations are hard to substitute in tests and can block request workers.

Target: interfaces such as `BackupStore`, `FilePicker`, `ReceiptPrinter`, and
`LicenseStore`, with Windows implementations injected into application services.

### 8. Security configuration is not production-safe

The settings model contains a default JWT secret. Authorization is not expressed
as a consistent router policy, and admin-role fallback behavior can conceal old
schema/data errors. Public/authenticated endpoint intent should be auditable in
one place.

Target: fail startup when a production secret is absent, make role checks
strict, declare router-level dependencies, limit CORS to required loopback
origins, and add authorization contract tests before changing behavior.

### 9. Duplicate and ambiguous definitions

CRUD/import/export behavior is repeated across master-data modules. Medicine
contains duplicate export/import route declarations. Response envelopes and
error shapes vary. Settings repeat get-or-create and update patterns. Duplicate
database dependencies previously existed in the license module.

Target: shared application-level primitives, not generic routers that hide
business rules. Add a route uniqueness test and a single response/error policy.

### 10. Testing and repository hygiene are weak

There is no cohesive automated suite covering transaction invariants, upgrade
paths, route authorization, or UI workflows. Generated databases, licenses,
logs, executables, debug outputs, and backup copies are present around source,
increasing accidental leakage and noisy diffs.

Target: unit, integration, contract, and installer test layers; generated
artifacts outside source control; sanitized fixtures only.

## Refactoring strategy

### Phase 1: establish safety rails

- Snapshot current OpenAPI and add a route uniqueness assertion.
- Add integration tests for sale, sale return, purchase, purchase return,
  authentication, licensing, backup/restore, and historical DB upgrade.
- Define performance fixtures representing multiple years of transactions.
- Record SQLite query plans and endpoint latency before optimizing.

### Phase 2: normalize boundaries

- Route all frontend traffic through one typed HTTP adapter.
- Introduce feature API modules without redesigning screens.
- Move router registration to the composition root (started in
  `backend/api/router.py`).
- Use the canonical database dependency everywhere.
- Standardize errors and response envelopes while retaining compatibility.

### Phase 3: extract workflows

- Extract sales, returns, purchasing, inventory adjustment, and backup services
  one endpoint at a time.
- Give each write workflow one explicit unit-of-work boundary.
- Move calculations into pure functions and cover edge cases with unit tests.
- Put OS/filesystem behavior behind adapters.

Suggested backend dependency direction:

```text
api -> application -> domain
                    -> ports <- infrastructure
```

The domain and application layers must not import FastAPI, Tauri, or concrete
filesystem/database implementations.

### Phase 4: split UI features

For each large screen, retain the page as a composition component and extract:

```text
features/sales/
  api.ts
  types.ts
  use-sale-session.ts
  pricing.ts
  components/
```

Use reducers for multi-step transactional forms, memoize only measured hot
paths, and virtualize large tables. Do not introduce global state for state that
belongs to one workflow.

### Phase 5: optimize from evidence

- Replace sales-history N+1 queries with eager/batched loading.
- Push report aggregation into SQL and stream export rows.
- Add bounded pagination to every history/list endpoint.
- Configure and test SQLite WAL, foreign keys, busy timeout, and checkpoints.
- Add indexes only when representative `EXPLAIN QUERY PLAN` output justifies
  them; excessive indexes slow every stock-changing transaction.

### Phase 6: harden release engineering

- Make Alembic the sole schema authority.
- Test upgrades from every supported release fixture.
- Build from a clean checkout and produce checksums/SBOM.
- Run installer tests for active-process update, clean install, rollback, and
  AppData preservation.

## Production-grade implementation rules

1. Preserve API contracts while moving code; contract tests enforce this.
2. Never commit inside repositories/helpers; application services own commits.
3. Use `Decimal` end-to-end for money and document rounding at business edges.
4. Pass clocks, filesystem roots, and OS services as dependencies.
5. Keep interactive queries bounded and exports streaming.
6. Never perform blocking OS work on the async event loop.
7. Log workflow IDs and outcomes, but never tokens, passwords, or license keys.
8. Prefer explicit feature code over inheritance-heavy generic CRUD frameworks.

## Changes made in this quality pass

- Added a dedicated API composition root, reducing `main.py` coupling while
  preserving all existing prefixes, tags, and handlers.
- Removed the duplicate license database-session dependency and reused the
  canonical dependency from `api.deps`.
- Reused the central token lookup in startup and authentication providers,
  preserving the existing local/session storage precedence.

These are intentionally small seams. The higher-risk extractions above should
proceed only behind characterization and contract tests so code quality improves
without silently changing pharmacy behavior.
