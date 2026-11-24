# TradeNest implementation progress

Branch: `feat/tradenest-complete`  
MCA source: `docs/TradeNest_Synopsis.pdf` (30 pages, copied from the user-approved newest Downloads copy).  
Scope: educational paper trading only; no broker, payment, real-money order, public deployment, or change to `main`.

## Checkpoints and completed functionality

| Checkpoint | Completed work | Verification |
| --- | --- | --- |
| 1 — Schema and trading | Virtual wallets, market and limit orders, reservations, cancellation, holdings, transaction ledger, admin quote settlement, RLS and audit trails. Added idempotency keys, exact SQL `numeric` cost basis, proportional sell cost allocation, quote/wallet locks, unique settlement indexes and narrow table grants. | All three migrations executed in PGlite. Database integration workflow passed. |
| 2 — Account and paper UI | Existing Supabase Auth UI, protected `/paper` and `/admin` routes, profile, watchlist, virtual wallet, order history, alerts and notifications. | Route guard tests passed for signed-out redirect and persisted-session restoration; database signup triggers created profiles, wallets and trader roles for three test users. |
| 3 — Reports, admin and security | CSV export and report/audit metadata, rule-based risk summaries, read-only broker view, administrator stock/rules/role/KYC/template controls. Blocked direct financial writes and cross-user inserts; guarded CSV spreadsheet formulas. | Database workflow passed for alerts, report audit, admin-only quote updates, and trader isolation. CSV calculation/escaping tests passed. |
| 4 — Regression and quality | Existing dashboard, chart, AI, news, analytics, optimizer and manual portfolio modules retained. Removed duplicate stock-data request and resolved existing lint issues. | Final commands and counts below. |

## Database migration and integration results

- `supabase/migrations/20260430071149_306e74a9-4199-4613-bfbb-0472cf8fcf28.sql`, `20260430071208_292d5045-982b-4d6a-9c8c-8ef00bba46b4.sql`, and `20261121000100_tradenest_paper_platform.sql` all executed successfully, in order, against a fresh local **PGlite PostgreSQL engine**. The test bootstraps compatible `auth.users`, `auth.uid()`, and client roles; it does not emulate the Supabase Auth HTTP service.
- Catalog checks confirmed 16 required baseline/paper tables with RLS, the four financial read policies, foreign keys, four critical order/transaction indexes, a `SECURITY DEFINER` order function, authenticated execution access, revoked anon execution and revoked direct wallet updates.
- Three demo users received profiles, 100,000 initial virtual credits and trader roles from signup triggers. A separate 100,000-credit virtual deposit brought the test trader to 200,000. A two-share BUY at 2,750 debited 5,500, a one-share SELL at 3,000 credited 3,000 and realized 250 profit. Subsequent limit BUY/SELL settlement, 200-credit refund, cancellation, reservation accounting and final 2-share/5,433.33 cost-basis position were asserted from database rows.
- Replayed wallet/order idempotency keys produced one mutation; mismatched replay, overselling, over-withdrawal, duplicate cancellation, direct settlement, unauthorized quote update, role escalation, direct financial update and cross-user report/alert insertion were rejected. Bob could not read Alice's wallet, holdings, orders or reports. One price alert fired once; report export and sensitive operations wrote audit records.
- SQL `numeric` calculations are exact to the declared scale. The frontend uses `decimal.js` for aggregate paper portfolio monetary values. The original UI still receives JavaScript numbers from PostgREST, so extremely large values near the database's `numeric(16,2)` ceiling should be serialized as decimal strings before production-scale use.

## Exact final checks

| Command | Result |
| --- | --- |
| `npm test` | **10 passed, 0 failed** across 4 files (2 database integration, 2 protected-route, 5 portfolio/CSV, 1 existing smoke test). |
| `npm run lint` | **0 errors, 0 warnings**. Baseline was 25 errors and 11 warnings. Narrow Fast Refresh exemptions apply to generated UI primitives and the shared symbol context, which intentionally export helpers. |
| `npx tsc --noEmit -p tsconfig.app.json` | Passed. |
| `npm run build` | Passed. Vite still reports a large JS chunk and stale Browserslist metadata as non-failing build notices. |
| `git diff --check` | Passed. |

During implementation, one new test assertion failed because its helper returned a string; the assertion was corrected and the full suite reran green. An intermediate TypeScript failure in chart shape props was corrected and rerun green. No final failing tests remain.

## MCA synopsis compliance (section 8, eight modules)

| Synopsis module | Status and evidence | Remaining gap |
| --- | --- | --- |
| 1. Authentication and Access Control | **Partial.** Supabase Auth registration/login UI, JWT-backed client, route guard and PostgreSQL RBAC. Route-guard and DB role checks passed. | Live signup, password login, OAuth, token refresh and logout were not end-to-end tested without Supabase Auth. |
| 2. User Profile, KYC and Wallet | **Partial.** Profile/wallet trigger, profile editing UI, admin KYC label, virtual deposits/withdrawals, blocked funds and ledger. DB workflow passed. | KYC is a paper-trading status label, not document verification; live frontend/Auth integration remains unverified. |
| 3. Market Data and Watchlist | **Partial.** Existing Yahoo/demo market views and news preserved; searchable simulated stock catalog and persistent watchlist UI. | Live market feed and browser watchlist persistence were not tested in this environment. |
| 4. Order and Portfolio Management | **Partial.** Instant/limit buy/sell, cancellation, reservations, holdings, average cost, realized/unrealized P/L and history. Database workflow passed. | Full browser-to-Supabase flow and genuine multi-session race test await a local Supabase stack. |
| 5. AI-Powered Trading Intelligence | **Partial.** Existing AI decision/chat/news integrations retained; rule-based paper risk score and saved portfolio summaries. | Paper portfolio summary is rule based rather than LLM generated; personalized alert recommendations and live AI response tests remain. |
| 6. Alerts and Notification | **Partial.** Price alerts, one-time trigger, order/fund/alert in-app notifications and admin templates tested in SQL. | Portfolio risk warning notifications and external email/SMS/push delivery are absent. |
| 7. Analytics and Reporting | **Partial.** Account KPIs, holdings/sector concentration, transaction/order history and CSV export implementation; CSV formatter and report audit metadata tested. | PDF export, tax report, paper portfolio performance trend and actual browser download verification are absent. |
| 8. Admin and System Configuration | **Partial.** Roles, stock master, quotes, trade limits, KYC status, templates and audit views; admin RPC checks tested. Broker gets read-only staff access. | Full browser UI with a real administrator session has not been exercised. |

### Architecture difference

The synopsis proposes a three-tier React + **Java 17/Spring Boot 3 + Hibernate/JPA** REST backend with MySQL 8 or PostgreSQL, JUnit/Mockito/Postman and JWT authentication. This repository already uses React/Vite with **Supabase Auth, PostgreSQL tables/RLS and SQL RPCs**, plus Supabase Edge Functions for market/AI calls. The paper-trading business transactions live in PostgreSQL functions, not a Spring Boot service. Adding Spring Boot would require an explicit migration plan for Auth/JWT ownership, REST contracts, SQL transaction logic, RLS, data migration and frontend API calls; no second backend was introduced. Supabase SQL tests do not count as Spring Boot, JUnit or Postman tests.

## Environment blockers and safe next test step

- Docker Desktop, Docker CLI, local `postgres`/`psql`, and a full Supabase CLI stack were unavailable on this Mac. The Supabase CLI installed temporarily for inspection requires a container runtime for `supabase start`; no local Auth/PostgREST service could be launched. The host also had about 4.3 GB free disk, below the synopsis's 10 GB minimum. No migration was sent to the configured remote Supabase project.
- PGlite supplies a real local PostgreSQL engine and proves migration SQL, constraints, privileges, RLS and RPC behavior with mocked JWT subjects. It does **not** prove GoTrue signup/login, OAuth, session refresh, PostgREST serialization, browser CSV download, Edge Functions, or concurrent sessions.
- To complete live E2E safely, install Docker Desktop and the Supabase CLI, start a **local** Supabase project, apply migrations to that local database only, set `.env.local` to the CLI's local URL and anon key, then run a browser scenario with three fresh demo accounts and a manually promoted local admin. Run concurrent order/quote requests against separate connections. Do not use the tracked remote `.env` project for this verification.

## Local startup

1. Run `npm ci` (Node 20 or newer), then `npm test`, `npm run lint`, `npx tsc --noEmit -p tsconfig.app.json`, and `npm run build`. The database integration tests use PGlite and require no Docker.
2. For live Auth/E2E work, install Docker Desktop and Supabase CLI; from the repository run `supabase start` and `supabase db reset --local` **only after confirming the CLI is pointed at the local instance**. `supabase status` prints the local URL and anon key.
3. Create `.env.local` with `VITE_SUPABASE_URL=<local API URL>` and `VITE_SUPABASE_PUBLISHABLE_KEY=<local anon key>`. Run `npm run dev`, register a test account at `/auth`, and use `/paper`.
4. To exercise `/admin`, promote one trusted **local test** account using a database-owner session: `update public.user_roles set role_id = 'admin', updated_at = now() where user_id = '<local-test-user-uuid>';`. Subsequent role changes use the admin UI.
