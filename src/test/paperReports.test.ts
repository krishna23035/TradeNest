import { describe, expect, it } from "vitest";
import { buildPaperReport, reportCsv, reportPdf, validateDateRange, type ReportData } from "@/lib/paperReports";

const fixture: ReportData = {
  holdings: [{ user_id: "user", symbol: "DEMO", quantity: 2, cost_basis: 20.02, avg_price: 10.01, realized_pl: 1.99, updated_at: "2026-01-03T10:00:00Z" }],
  stocks: [{ symbol: "DEMO", company_name: "Demonstration", exchange: "NSE", sector: "=2+2", last_price: 12, updated_at: "2026-01-03T10:00:00Z", quote_source: "simulated" }],
  orders: [
    { id: "buy", user_id: "user", idempotency_key: "key1", symbol: "DEMO", side: "BUY", quantity: 3, order_kind: "MARKET", limit_price: null, reserved_amount: 0, executed_price: 10.01, status: "EXECUTED", created_at: "2026-01-01T10:00:00Z", executed_at: "2026-01-01T10:00:00Z" },
    { id: "sell", user_id: "user", idempotency_key: "key2", symbol: "DEMO", side: "SELL", quantity: 1, order_kind: "MARKET", limit_price: null, reserved_amount: 0, executed_price: 12, status: "EXECUTED", created_at: "2026-01-03T10:00:00Z", executed_at: "2026-01-03T10:00:00Z" },
  ],
  transactions: [
    { id: "deposit", user_id: "user", order_id: null, idempotency_key: "key3", txn_type: "VIRTUAL_DEPOSIT", amount: 100000, balance_after: 200000, created_at: "2026-01-01T09:00:00Z" },
    { id: "buytxn", user_id: "user", order_id: "buy", idempotency_key: null, txn_type: "BUY", amount: 30.03, balance_after: 199969.97, created_at: "2026-01-01T10:00:00Z" },
  ],
  quotes: [{ id: 1, symbol: "DEMO", price: 12, source: "simulated_update", captured_at: "2026-01-02T10:00:00Z" }],
  wallet: { user_id: "user", available_balance: 199981.97, blocked_balance: 0, updated_at: "2026-01-03T10:00:00Z" },
};

describe("authenticated paper report data formatting", () => {
  it("calculates portfolio and P/L totals from current account rows", () => {
    const portfolio = buildPaperReport("PORTFOLIO", fixture);
    expect(portfolio.rows[0]).toEqual(["DEMO", "=2+2", "2", "20.02", "12.00", "24.00", "3.98"]);
    expect(portfolio.summary).toContain("Total P/L: 5.97");
    const pl = buildPaperReport("PROFIT_LOSS", fixture);
    expect(pl.rows[0].at(-1)).toBe("5.97");
    expect(pl.summary.some((line) => line.includes("Recorded event period"))).toBe(true);
  });

  it("filters UTC activity dates and rejects invalid ranges", () => {
    expect(buildPaperReport("TRADE", fixture, { from: "2026-01-01", to: "2026-01-02" }).rows).toHaveLength(1);
    expect(buildPaperReport("STATEMENT", fixture, { from: "2026-01-02", to: "2026-01-03" }).rows).toHaveLength(0);
    expect(() => validateDateRange({ from: "2026-02-30" })).toThrow();
    expect(() => validateDateRange({ from: "2026-01-04", to: "2026-01-03" })).toThrow();
  });

  it("neutralizes spreadsheet formulas in exported account data", () => {
    const csv = reportCsv(buildPaperReport("PORTFOLIO", fixture));
    expect(csv).toContain("'=2+2");
    expect(csv.startsWith("\uFEFFSymbol,Sector")).toBe(true);
  });

  it("generates a genuine PDF document", async () => {
    const pdf = await reportPdf(buildPaperReport("PORTFOLIO", fixture));
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(2000);
  });
});
