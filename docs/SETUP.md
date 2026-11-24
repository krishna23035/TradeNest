# TradeNest local and staging setup

## Safe default: code and database tests

From `/Users/krishnakumar/Desktop/Stock-Predictor-Model` on `feat/tradenest-complete`:

```sh
npm ci
npm test
npm run lint
npx tsc --noEmit -p tsconfig.app.json
npm run build
```

`npm test` creates an isolated PGlite PostgreSQL database in memory, applies every migration in order, and tests SQL/RLS. It neither connects to the URL in tracked `.env` nor changes any remote project.

## Full local Supabase stack

Install Docker Desktop and the Supabase CLI. Start Docker, then run `supabase start` from this repository. Confirm that `supabase status` shows **localhost** API and database addresses before applying migrations. Only then run `supabase db reset --local`; this resets the disposable **local** database and applies all migrations. Never run `supabase db push` or a reset command against the tracked remote project.

Create `.env.local` with the local API URL and local anon/publishable key printed by `supabase status`:

```dotenv
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLISHABLE_KEY=<local-anon-key>
```

Run `npm run dev`; open the shown localhost URL. The `.env.local` file is for local keys and must not contain a service-role key. The machine used for Phase 3 had no Docker Desktop. Its installed Supabase CLI 3.2.0 offered container-based `start` but no native `stack` command, despite newer Supabase documentation describing an experimental native runtime. No full local Supabase stack was started here.

## Isolated staging alternative

Use a **new, private Supabase project** or a schema-only preview branch dedicated to TradeNest testing. Supabase [documents staging and preview environments](https://supabase.com/docs/guides/deployment/branching); preview branches can copy schema without production data. This repository's `supabase/config.toml` and tracked `.env` identify an existing remote project, so verify the staging project reference and URL explicitly before applying any migration. Do not copy production users, wallets, or secrets into staging.

The current environment has no Supabase access token, staging database credentials, staging URL or `.env.local`. A staging migration and live Auth test therefore need a separately provisioned project and credentials. Store those outside Git and use only a staging anon key in the browser. Apply migrations in filename order after confirming the destination is the isolated project.

## Demonstration workflow on local or isolated staging

1. Register Alice and Bob at `/auth`; complete email confirmation if the test project requires it. Sign in as Alice. Verify a profile, trader role and 100,000 initial **virtual credits**.
2. At `/paper`, add 100,000 demo credits, choose `RELIANCE`, buy two shares, and verify the available balance decreased by `2 ×` the simulated quote. Inspect holdings, order history and the virtual ledger.
3. In a separate local administrator account, set the simulated quote to a higher amount in `/admin`. Return to Alice and sell one share. Verify balance credit and realized P/L. The chart's market feed is separate from the simulated execution quote.
4. Create a limit BUY below the current simulated quote and verify blocked credits. Cancel it and verify the refund. Repeat with a new limit order, then have the administrator move the simulated quote across the limit. Verify one settlement and one transaction. Try a duplicate request and an oversell; both must be rejected or replay safely.
5. Create an ABOVE price alert, change the admin quote to the target, and verify one in-app notification. Inspect the portfolio concentration warning after a concentrated holding.
6. Download portfolio, trade, wallet and profit/loss reports in **CSV and PDF**. Check totals, date filters, current-snapshot labels, and report/audit history. Inspect the event-based valuation chart, sector and holding pies, and P/L bars.
7. Sign out and check `/paper` redirects to `/auth`. Sign in as Bob and verify Alice's wallet, orders, holdings, reports and AI logs are invisible. Verify Bob cannot use `/admin` or invoke admin RPCs.

To create the first **local or isolated staging** administrator, a database owner may run:

```sql
update public.user_roles
set role_id = 'admin', updated_at = now()
where user_id = '<trusted-local-or-staging-test-user-uuid>';
```

Use only a disposable test identity. The application contains no broker or payment integration and cannot execute real-money trades.
