import { describe, expect, it } from "vitest";
import { estimateDailyVolatility, portfolioMetrics, portfolioRisk, toCsv } from "@/lib/paperMath";

describe("paper portfolio calculations", () => {
  it("handles an empty account", () => {
    expect(portfolioMetrics([]).value).toBe(0);
    expect(portfolioRisk([], 0).label).toBe("No positions");
  });

  it("calculates unrealized and realized profit separately", () => {
    const positions = [
      { symbol: "AAPL", sector: "Tech", quantity: 2, avgPrice: 100, lastPrice: 125, realizedPl: 10 },
      { symbol: "TCS", sector: "Tech", quantity: 1, avgPrice: 200, lastPrice: 180, realizedPl: -5 },
    ];
    expect(portfolioMetrics(positions)).toMatchObject({ value: 430, cost: 400, unrealizedPl: 30, realizedPl: 5 });
    expect(portfolioRisk(positions, 20).score).toBeGreaterThan(portfolioRisk(positions, 0).score);
  });

  it("escapes user supplied CSV fields", () => {
    expect(toCsv([["symbol", "note"], ["AAPL", 'text, "quoted"']])).toBe('symbol,note\r\nAAPL,"text, ""quoted"""\r\n');
    expect(toCsv([["name"], ["=HYPERLINK(\"https://example.test\")"]])).toBe('name\r\n"\'=HYPERLINK(""https://example.test"")"\r\n');
  });

  it("uses decimal arithmetic for fractional paper values", () => {
    const metrics = portfolioMetrics([
      { symbol: "A", sector: "Tech", quantity: 1, avgPrice: 0.1, costBasis: 0.1, lastPrice: 0.2, realizedPl: 0.1 },
      { symbol: "B", sector: "Tech", quantity: 1, avgPrice: 0.2, costBasis: 0.2, lastPrice: 0.3, realizedPl: 0.2 },
    ]);
    expect(metrics).toMatchObject({ value: 0.5, cost: 0.3, unrealizedPl: 0.2, realizedPl: 0.3 });
  });

  it("estimates volatility from changes in daily closes", () => {
    expect(estimateDailyVolatility([100, 101, 99, 103])).toBeGreaterThan(0);
    expect(estimateDailyVolatility([100])).toBe(0);
  });
});
