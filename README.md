# TradeNest

TradeNest is an educational stock dashboard and paper trading platform. The existing market charts, analytics, AI chat, news, model comparison, optimizer, and manual portfolio tracker remain available. The new `/paper` area adds a separate Supabase-backed virtual account. **No order or wallet action connects to a broker, payment service, or real-money account.**

The MCA source document is [`docs/TradeNest_Synopsis.pdf`](docs/TradeNest_Synopsis.pdf). Implementation status and verification are in [`IMPLEMENTATION_PROGRESS.md`](IMPLEMENTATION_PROGRESS.md).

Project documentation: [setup](docs/SETUP.md), [database architecture](docs/DATABASE_ARCHITECTURE.md), [API and RPCs](docs/API.md), [testing report](docs/TESTING_REPORT.md), and [MCA compliance checklist](docs/MCA_COMPLIANCE.md).

## Local development

1. Use Node.js 20 or newer and install dependencies with `npm ci`.
2. For browser integration testing, put `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from a **local Supabase project** in `.env.local`. The tracked `.env` points to a remote project; do not use it for migration or demo trades. Never put a service-role key in the frontend.
3. Apply all SQL migrations in `supabase/migrations` in filename order to that test database. They create the paper account, simulated quote history, PDF report metadata type, and risk-warning trigger. See [setup](docs/SETUP.md) before running any database command.
4. Run `npm run dev` and sign up at `/auth`. A new account receives 100,000 virtual credits. Use `/paper` for simulated trading.

The migration does not assign an initial administrator. A database owner must explicitly grant the first trusted **local** test account the admin role after signup, for example from the local Supabase SQL editor:

```sql
update public.user_roles
set role_id = 'admin', updated_at = now()
where user_id = '<trusted-test-auth-user-uuid>';
```

Only use this for a test account in a private/local project. Subsequent role changes are available through `/admin`. The `broker` role provides a read-only support and audit view. Trading rules, simulated quotes, stock master records, KYC labels, and in-app notification templates are admin controlled.

## How paper trading works

- Instant orders execute at the server-owned **simulated** stock quote, independent of the market chart's Yahoo quote.
- Limit orders reserve virtual credits or shares. An admin quote update executes eligible pending orders; users may cancel pending orders.
- Database functions atomically validate funds, shares, quantities, and order rate limits before updating holdings and transaction history. Row-level security restricts account records by user.
- Wallet deposits and withdrawals move virtual credits only. No payment details are requested.
- Price alerts trigger on admin simulated quote changes. In-app notifications show alerts, orders, and wallet changes.
- Risk scores and portfolio summaries are rule based and educational. Existing AI market features use their configured APIs separately.
- Portfolio, trading, wallet and profit/loss reports download as CSV or PDF from fresh authenticated account queries. The database stores export metadata and audit entries, not report files.
- The paper analytics chart values holdings only at executed-order and recorded simulated-quote events. It does not invent daily price history.
- News sentiment uses fetched headlines and a simple word score. If news cannot be fetched, it says unavailable. Market projections and model comparisons are labeled as heuristics rather than trained ML predictions.

The older Portfolio page remains a browser-local manual tracker. Its entries are not automatically converted into paper holdings, because doing so would create virtual financial transactions without an explicit user action.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Local Vite development server |
| `npm run build` | Production bundle build |
| `npm run build:dev` | Development-mode bundle build |
| `npm run preview` | Preview a built bundle locally |
| `npm test` | Run Vitest tests |
| `npm run test:watch` | Watch Vitest tests |
| `npm run lint` | Run ESLint |

## Verification limits

`npm test` executes all SQL migrations and verifies wallet, order, alert, report, admin and RLS behavior in a local PGlite PostgreSQL engine without Docker. This machine lacks Docker Desktop and separate staging credentials, so live Supabase Auth, PostgREST, browser downloads and concurrent-session tests remain outstanding. See [testing report](docs/TESTING_REPORT.md) for exact results.
