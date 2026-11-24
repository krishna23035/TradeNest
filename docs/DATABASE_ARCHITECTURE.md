# TradeNest database architecture

The current backend is **Supabase Auth + PostgreSQL RLS + SQL RPCs**, with Supabase Edge Functions for market and AI requests. This follows the repository's existing architecture. The MCA synopsis proposes **Java 17 / Spring Boot 3, Hibernate/JPA and REST APIs**, with MySQL or PostgreSQL. No Spring service exists in this repository. A future replacement would need a planned Auth/JWT, API contract, transaction, RLS and data migration; a second backend was not added.

## Migration order

1. `20260430071149_306e74a9-4199-4613-bfbb-0472cf8fcf28.sql`: profiles, signup trigger, watchlist, legacy portfolio and predictions.
2. `20260430071208_292d5045-982b-4d6a-9c8c-8ef00bba46b4.sql`: locks down direct execution of the signup trigger.
3. `20261121000100_tradenest_paper_platform.sql`: roles, simulated stock master, wallet, order, holdings, transactions, alerts, notifications, AI logs, reports, audit, settings, policies and RPCs.
4. `20261121000200_tradenest_quote_history_and_reports.sql`: timestamped simulated quote observations, profit/loss report type and concentration warning trigger.

The two TradeNest migrations are additive to the baseline; `paper_quote_history` records a **current snapshot at migration time** for preexisting stocks, never an invented past price. New simulated stock inserts and price changes append observations. No daily prices are synthesized for paper portfolio history.

## Data ownership and links

| Entity | Key relationship | Client access |
| --- | --- | --- |
| `auth.users`, `profiles`, `user_roles`, `wallets` | One profile, role and wallet per auth user; signup triggers initialize them. | Own profile/role/wallet read; profile name/avatar update only. |
| `stocks`, `paper_quote_history` | Quote history references stock symbol. | Authenticated read; admin quote/stock RPCs write. |
| `orders`, `holdings`, `transactions` | User owns orders/holdings/ledger; transactions reference at most one order. | Owner read; staff support read where policy allows; financial writes only through RPCs. |
| `price_alerts`, `notifications`, `ai_logs`, `reports` | Each record references an auth user. | Owner read; narrowly allowed owner inserts/cancellations where appropriate; staff reads AI/report metadata. |
| `audit_logs`, `system_settings`, `notification_templates` | Global settings, templates and append-only audit entries. | Staff read; administrator RPCs change settings/templates. |

RLS is enabled on all paper tables. `authenticated` clients have explicit table privileges; direct wallet, order, holdings, transaction, stock, role and audit writes are revoked. `anon` cannot execute financial RPCs. Users cannot choose another account in an RPC: the functions use `auth.uid()`. Admin mutations require `is_admin()` server-side, and broker support is read only.

## Financial transaction boundaries

- `adjust_paper_wallet` locks the caller's wallet, checks a UUID idempotency key, validates a two-decimal amount and performs balance, transaction, notification and audit writes in one PostgreSQL transaction.
- `place_paper_order` locks the simulated quote and wallet, then validates quantity, value, rate, funds or unreserved shares. It writes holdings, wallet, order, unique order transaction, notification and audit atomically.
- `place_paper_limit_order` reserves available credits for BUY or unreserved shares for SELL. Cancellation releases credits. Admin `set_simulated_quote` changes the quote and settles eligible orders in the same transaction, refunding any BUY price improvement. `transactions_order_once_idx` prevents duplicate settlement records.
- PostgreSQL `numeric` stores two-decimal balances, quote prices and exact holdings cost basis. Sells allocate proportional cost to two decimals; eight-decimal `avg_price` is a display quotient. The browser uses `decimal.js` to aggregate monetary values, although Supabase JSON currently exposes large `numeric` values as JavaScript numbers; values approaching the database precision ceiling need decimal-string serialization before production-scale use.
- `paper_quote_history` supports event-based holdings valuation from recorded quote changes and executed prices. It is a **simulated** market ledger. It must not be presented as historical exchange prices or daily returns.

## Notifications and reporting

An admin quote update marks eligible alerts `TRIGGERED` and inserts one notification from rows actually changed. Holdings changes can create a concentration warning when one symbol is at least 60% of simulated holdings value; the trigger limits this to one warning per user per day. Report exports insert metadata into `reports` and create `report_exported` audit rows. CSV/PDF bytes are generated locally in the authenticated browser and are not stored in PostgreSQL.

The PGlite integration suite executes all migrations and tests RLS, privileges and SQL behavior using mocked JWT subjects. It cannot test actual Supabase Auth, PostgREST serialization or concurrent connections; those require local Supabase or a separately provisioned staging project.
