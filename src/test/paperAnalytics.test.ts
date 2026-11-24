import { describe, expect, it } from "vitest";
import { gainLossSummary, portfolioValuationHistory } from "@/lib/paperAnalytics";

describe("recorded paper portfolio analytics", () => {
  const orders = [
    { id: "buy", symbol: "DEMO", side: "BUY" as const, quantity: 3, executed_price: 10.01, executed_at: "2026-01-01T10:00:00Z", status: "EXECUTED" as const },
    { id: "sell", symbol: "DEMO", side: "SELL" as const, quantity: 1, executed_price: 12.00, executed_at: "2026-01-03T10:00:00Z", status: "EXECUTED" as const },
  ];
  const quotes = [
    { id: 1, symbol: "DEMO", price: 11.00, captured_at: "2026-01-02T10:00:00Z", source: "simulated_update" },
  ];

  it("uses only executed orders and recorded quotes, with exact cost allocation", () => {
    const points = portfolioValuationHistory(orders, quotes);
    expect(points).toHaveLength(3);
    expect(points.map((point) => point.value)).toEqual([30.03, 33, 24]);
    expect(points[2]).toMatchObject({ cost: 20.02, realizedPl: 1.99, unrealizedPl: 3.98, totalPl: 5.97 });
    expect(gainLossSummary(points)).toMatchObject({ highestValue: 33, lowestValue: 24, change: 5.97 });
  });

  it("ignores pending orders and refuses incomplete historical ledgers", () => {
    expect(portfolioValuationHistory([{ ...orders[0], status: "PENDING" }], quotes)).toEqual([]);
    expect(() => portfolioValuationHistory([orders[1]], quotes)).toThrow("Incomplete order history");
  });
});
