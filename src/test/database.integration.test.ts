// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

let db: PGlite;
const ALICE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BOB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ADMIN = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const KEY = (n: number) => `dddddddd-dddd-4ddd-8ddd-${String(n).padStart(12, "0")}`;

async function asOwner() {
  await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false);");
}

async function asUser(id: string) {
  await asOwner();
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
  await db.exec("set role authenticated;");
}

async function scalar(sql: string, params: unknown[] = []) {
  const result = await db.query<Record<string, unknown>>(sql, params);
  return String(Object.values(result.rows[0] ?? {})[0]);
}

beforeAll(async () => {
  db = await PGlite.create();
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create table auth.users (
      id uuid primary key,
      email text,
      raw_user_meta_data jsonb not null default '{}'::jsonb
    );
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    grant usage on schema public, auth to authenticated;
    grant select, insert, update, delete on auth.users to authenticated;
    alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
  `);
  for (const name of [
    "20260430071149_306e74a9-4199-4613-bfbb-0472cf8fcf28.sql",
    "20260430071208_292d5045-982b-4d6a-9c8c-8ef00bba46b4.sql",
    "20261121000100_tradenest_paper_platform.sql",
    "20261121000200_tradenest_quote_history_and_reports.sql",
  ]) {
    await db.exec(readFileSync(resolve("supabase/migrations", name), "utf8"));
  }
});

afterAll(async () => { await db?.close(); });

describe("PostgreSQL migration integration", () => {
  it("creates the paper account tables and enables RLS", async () => {
    const tables = ["roles", "user_roles", "profiles", "stocks", "wallets", "orders", "holdings",
      "transactions", "price_alerts", "notifications", "notification_templates", "ai_logs", "reports",
      "audit_logs", "system_settings", "watchlist", "paper_quote_history"];
    const created = await db.query<{ relname: string; relrowsecurity: boolean }>(`
      select relname, relrowsecurity from pg_class
      where relnamespace = 'public'::regnamespace and relkind = 'r'
    `);
    expect(tables.every((name) => created.rows.some((row) => row.relname === name && row.relrowsecurity))).toBe(true);
    const result = await db.query<{ relname: string; relrowsecurity: boolean }>(`
      select relname, relrowsecurity from pg_class
      where relnamespace = 'public'::regnamespace and relkind = 'r'
        and relname in ('wallets', 'orders', 'holdings', 'transactions', 'price_alerts', 'audit_logs')
      order by relname
    `);
    expect(result.rows).toHaveLength(6);
    expect(result.rows.every((row) => row.relrowsecurity)).toBe(true);
    expect(await scalar("select count(*) from pg_policies where schemaname = 'public' and tablename in ('wallets', 'orders', 'holdings', 'transactions')")).toBe("4");
    expect(Number(await scalar("select count(*) from pg_constraint where contype = 'f' and connamespace = 'public'::regnamespace"))).toBeGreaterThan(10);
    expect(await scalar("select count(*) from pg_indexes where schemaname = 'public' and indexname in ('orders_user_created_idx', 'orders_pending_symbol_idx', 'transactions_order_once_idx', 'transactions_wallet_request_once_idx')")).toBe("4");
    expect(await scalar("select prosecdef from pg_proc where oid = 'public.place_paper_order(text,text,integer,uuid)'::regprocedure")).toBe("true");
    expect(await scalar("select has_function_privilege('authenticated', 'public.place_paper_order(text,text,integer,uuid)', 'EXECUTE')")).toBe("true");
    expect(await scalar("select has_function_privilege('anon', 'public.place_paper_order(text,text,integer,uuid)', 'EXECUTE')")).toBe("false");
    expect(await scalar("select has_table_privilege('authenticated', 'public.wallets', 'UPDATE')")).toBe("false");
    expect(await scalar("select count(*) from public.paper_quote_history where source = 'migration_snapshot'")).toBe("12");
  });

  it("executes the full virtual wallet, order, alert, report and RLS workflow", async () => {
    await asOwner();
    await db.query("insert into auth.users(id, email) values ($1, 'alice@example.test'), ($2, 'bob@example.test'), ($3, 'admin@example.test')", [ALICE, BOB, ADMIN]);
    expect(await scalar("select count(*) from public.profiles")).toBe("3");
    expect(await scalar("select count(*) from public.wallets where available_balance = 100000.00")).toBe("3");
    expect(await scalar("select count(*) from public.user_roles where role_id = 'trader'")).toBe("3");
    await db.query("update public.user_roles set role_id = 'admin' where user_id = $1", [ADMIN]);

    await asUser(ALICE);
    expect(await scalar("select count(*) from public.wallets")).toBe("1");
    expect(await scalar("select public.is_admin()")).toBe("false");
    await expect(db.query("select public.set_simulated_quote('RELIANCE', 3000)")).rejects.toThrow();
    await expect(db.query("update public.wallets set available_balance = 999999 where user_id = $1", [ALICE])).rejects.toThrow();
    expect(await scalar("select available_balance::text from public.wallets")).toBe("100000.00");

    expect(await scalar("select public.adjust_paper_wallet(100000, 'VIRTUAL_DEPOSIT', $1::uuid)", [KEY(1)])).toBe("200000.00");
    expect(await scalar("select public.adjust_paper_wallet(100000, 'VIRTUAL_DEPOSIT', $1::uuid)", [KEY(1)])).toBe("200000.00");
    expect(await scalar("select count(*) from public.transactions where txn_type = 'VIRTUAL_DEPOSIT'")).toBe("1");
    await expect(db.query("select public.adjust_paper_wallet(50000, 'VIRTUAL_DEPOSIT', $1::uuid)", [KEY(1)])).rejects.toThrow();

    const buyId = await scalar("select public.place_paper_order('RELIANCE', 'BUY', 2, $1::uuid)", [KEY(2)]);
    expect(await scalar("select public.place_paper_order('RELIANCE', 'BUY', 2, $1::uuid)", [KEY(2)])).toBe(buyId);
    expect(await scalar("select available_balance::text from public.wallets")).toBe("194500.00");
    expect(await scalar("select quantity::text || ':' || cost_basis::text from public.holdings where symbol = 'RELIANCE'")).toBe("2:5500.00");
    expect(await scalar("select count(*) from public.transactions where order_id = $1::uuid", [buyId])).toBe("1");
    expect(await scalar("select count(*) from public.notifications where title = 'Paper portfolio concentration warning'")).toBe("1");
    await expect(db.query("select public.place_paper_order('RELIANCE', 'SELL', 3, $1::uuid)", [KEY(3)])).rejects.toThrow();

    await asUser(ADMIN);
    expect(await scalar("select public.is_admin()")).toBe("true");
    await db.query("select public.set_simulated_quote('RELIANCE', 3000)");
    expect(await scalar("select count(*) from public.paper_quote_history where symbol = 'RELIANCE' and price = 3000")).toBe("1");
    await asUser(ALICE);
    await db.query("select public.place_paper_order('RELIANCE', 'SELL', 1, $1::uuid)", [KEY(4)]);
    expect(await scalar("select available_balance::text from public.wallets")).toBe("197500.00");
    expect(await scalar("select quantity::text || ':' || cost_basis::text || ':' || realized_pl::text from public.holdings where symbol = 'RELIANCE'")).toBe("1:2750.00:250.00");

    const limitBuy = await scalar("select public.place_paper_limit_order('RELIANCE', 'BUY', 2, 2800, $1::uuid)", [KEY(5)]);
    expect(await scalar("select public.place_paper_limit_order('RELIANCE', 'BUY', 2, 2800, $1::uuid)", [KEY(5)])).toBe(limitBuy);
    expect(await scalar("select available_balance::text || ':' || blocked_balance::text from public.wallets")).toBe("191900.00:5600.00");
    await asUser(ADMIN);
    await db.query("select public.set_simulated_quote('RELIANCE', 2700)");
    await asUser(ALICE);
    expect(await scalar("select available_balance::text || ':' || blocked_balance::text from public.wallets")).toBe("192100.00:0.00");
    expect(await scalar("select quantity::text || ':' || cost_basis::text from public.holdings where symbol = 'RELIANCE'")).toBe("3:8150.00");
    expect(await scalar("select count(*) from public.transactions where order_id = $1::uuid", [limitBuy])).toBe("1");

    await db.query("select public.place_paper_limit_order('RELIANCE', 'SELL', 1, 3100, $1::uuid)", [KEY(6)]);
    await expect(db.query("select public.place_paper_order('RELIANCE', 'SELL', 3, $1::uuid)", [KEY(7)])).rejects.toThrow();
    await asUser(ADMIN);
    await db.query("select public.set_simulated_quote('RELIANCE', 3200)");
    await db.query("select public.set_simulated_quote('RELIANCE', 3200)");
    await asUser(ALICE);
    expect(await scalar("select quantity::text || ':' || cost_basis::text || ':' || realized_pl::text from public.holdings where symbol = 'RELIANCE'")).toBe("2:5433.33:733.33");
    expect(await scalar("select available_balance::text from public.wallets")).toBe("195300.00");
    expect(await scalar("select count(*) from public.transactions where txn_type = 'SELL'")).toBe("2");

    await db.query("insert into public.price_alerts(user_id, symbol, target_price, condition_type) values ($1::uuid, 'RELIANCE', 3300, 'ABOVE')", [ALICE]);
    await asUser(ADMIN);
    await db.query("select public.set_simulated_quote('RELIANCE', 3350)");
    await asUser(ALICE);
    expect(await scalar("select status from public.price_alerts where symbol = 'RELIANCE'")).toBe("TRIGGERED");
    expect(await scalar("select count(*) from public.notifications where title = 'Simulated price alert'")).toBe("1");
    await asUser(ADMIN);
    await db.query("select public.set_simulated_quote('RELIANCE', 3400)");
    await asUser(ALICE);
    expect(await scalar("select count(*) from public.notifications where title = 'Simulated price alert'")).toBe("1");
    const pendingToCancel = await scalar("select public.place_paper_limit_order('RELIANCE', 'BUY', 1, 3000, $1::uuid)", [KEY(8)]);
    expect(await scalar("select blocked_balance::text from public.wallets")).toBe("3000.00");
    await expect(db.query("select public.settle_pending_paper_order($1::uuid, 3000)", [pendingToCancel])).rejects.toThrow();
    await db.query("select public.cancel_paper_order($1::uuid)", [pendingToCancel]);
    await expect(db.query("select public.cancel_paper_order($1::uuid)", [pendingToCancel])).rejects.toThrow();
    expect(await scalar("select available_balance::text || ':' || blocked_balance::text from public.wallets")).toBe("195300.00:0.00");
    expect(await scalar("select count(*) from public.transactions where order_id = $1::uuid", [pendingToCancel])).toBe("0");
    await expect(db.query("select public.adjust_paper_wallet(999999, 'VIRTUAL_WITHDRAWAL', $1::uuid)", [KEY(9)])).rejects.toThrow();
    expect(await scalar("select available_balance::text from public.wallets")).toBe("195300.00");
    await db.query("insert into public.reports(user_id, report_type, file_name) values ($1::uuid, 'TRADE', 'trades.csv')", [ALICE]);
    await db.query("insert into public.ai_logs(user_id, request_type, input_summary, ai_response) values ($1::uuid, 'SIGNAL', 'DEMO heuristic', 'HOLD: educational explanation')", [ALICE]);

    await asUser(BOB);
    expect(await scalar("select count(*) from public.orders")).toBe("0");
    expect(await scalar("select count(*) from public.holdings")).toBe("0");
    expect(await scalar("select count(*) from public.reports")).toBe("0");
    expect(await scalar("select count(*) from public.ai_logs")).toBe("0");
    expect(await scalar("select available_balance::text from public.wallets")).toBe("100000.00");
    await expect(db.query("insert into public.reports(user_id, report_type, file_name) values ($1::uuid, 'TRADE', 'stolen.csv')", [ALICE])).rejects.toThrow();
    await expect(db.query("insert into public.price_alerts(user_id, symbol, target_price, condition_type) values ($1::uuid, 'RELIANCE', 3000, 'ABOVE')", [ALICE])).rejects.toThrow();
    await expect(db.query("insert into public.ai_logs(user_id, request_type, input_summary, ai_response) values ($1::uuid, 'SIGNAL', 'forged', 'forged')", [ALICE])).rejects.toThrow();
    await expect(db.query("select public.set_user_role($1::uuid, 'admin')", [BOB])).rejects.toThrow();
    await expect(db.query("update public.user_roles set role_id = 'admin' where user_id = $1::uuid", [BOB])).rejects.toThrow();
    expect(await scalar("select public.is_admin()")).toBe("false");
    await expect(db.query("insert into public.orders(user_id, idempotency_key, symbol, side, quantity, executed_price, executed_at) values ($1::uuid, $2::uuid, 'RELIANCE', 'BUY', 1, 1, now())", [BOB, KEY(10)])).rejects.toThrow();

    await asUser(ADMIN);
    expect(await scalar("select count(*) from public.audit_logs where action = 'report_exported'")).toBe("1");
    expect(await scalar("select count(*) from public.audit_logs where action = 'paper_order_executed'")).toBe("2");
    await db.query("insert into public.reports(user_id, report_type, file_name) values ($1::uuid, 'PROFIT_LOSS', 'profit_loss.pdf')", [ADMIN]);
    await db.query("select public.set_user_role($1::uuid, 'broker')", [BOB]);
    await db.query("select public.set_kyc_status($1::uuid, 'pending')", [BOB]);
    await db.query("select public.update_trading_rules(500, 750000, 12)");
    await db.query("select public.set_notification_template('price_alert', 'Demo {symbol} at {price}')");
    await db.query("select public.upsert_simulated_stock('DEMO', 'Demonstration Ltd', 'NSE', 'Education', 101.25)");
    expect(await scalar("select count(*) from public.audit_logs where action in ('user_role_changed', 'kyc_status_changed', 'trading_rules_updated', 'notification_template_changed', 'simulated_stock_upserted')")).toBe("5");
    await asUser(BOB);
    expect(await scalar("select public.is_staff()")).toBe("true");
    expect(await scalar("select public.is_admin()")).toBe("false");
    expect(Number(await scalar("select count(*) from public.orders"))).toBeGreaterThan(0);
    await expect(db.query("select public.set_simulated_quote('DEMO', 105)")).rejects.toThrow();
    await asOwner();
  });
});
