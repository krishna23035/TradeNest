import Decimal from "decimal.js";

export type PaperPosition = {
  symbol: string;
  sector: string;
  quantity: number;
  avgPrice: number;
  costBasis?: number;
  lastPrice: number;
  realizedPl?: number;
  dailyVolatility?: number;
};

export function estimateDailyVolatility(closes: number[]) {
  const returns = closes.slice(1).map((price, index) => (price / closes[index] - 1) * 100)
    .filter((value) => Number.isFinite(value));
  if (returns.length < 2) return 0;
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  return Math.sqrt(returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (returns.length - 1));
}

export function portfolioMetrics(positions: PaperPosition[]) {
  const active = positions.filter((position) => position.quantity > 0);
  const valueDecimal = active.reduce((sum, position) => sum.plus(new Decimal(position.lastPrice).times(position.quantity)), new Decimal(0));
  const costDecimal = active.reduce((sum, position) => sum.plus(position.costBasis ?? new Decimal(position.avgPrice).times(position.quantity)), new Decimal(0));
  const value = valueDecimal.toNumber();
  const cost = costDecimal.toNumber();
  const unrealizedPl = valueDecimal.minus(costDecimal).toNumber();
  const realizedPl = positions.reduce((sum, position) => sum.plus(position.realizedPl ?? 0), new Decimal(0)).toNumber();
  const largestPositionPct = value === 0 ? 0 : Math.max(...active.map((position) => position.quantity * position.lastPrice / value)) * 100;
  const sectorTotalsDecimal = active.reduce<Record<string, Decimal>>((totals, position) => {
    totals[position.sector] = (totals[position.sector] ?? new Decimal(0)).plus(new Decimal(position.lastPrice).times(position.quantity));
    return totals;
  }, {});
  const sectorTotals = Object.fromEntries(Object.entries(sectorTotalsDecimal).map(([sector, amount]) => [sector, amount.toNumber()]));
  const largestSectorPct = value === 0 ? 0 : Math.max(...Object.values(sectorTotals)) / value * 100;
  return { value, cost, unrealizedPl, realizedPl, largestPositionPct, largestSectorPct, sectorTotals };
}

export function portfolioRisk(positions: PaperPosition[], tradesLast30Days: number) {
  const metrics = portfolioMetrics(positions);
  if (metrics.value === 0) return { score: 0, label: "No positions" as const, reasons: ["Place a paper trade to calculate portfolio risk."] };
  const weightedVolatility = positions.reduce((sum, position) =>
    sum + (position.quantity * position.lastPrice / metrics.value) * (position.dailyVolatility ?? 0), 0);
  const score = Math.min(100, Math.round(
    Math.max(0, metrics.largestPositionPct - 25) * 0.6 +
    Math.max(0, metrics.largestSectorPct - 40) * 0.4 +
    Math.max(0, weightedVolatility - 2) * 7 +
    Math.max(0, tradesLast30Days - 10) * 1.5,
  ));
  const reasons = [
    `Largest position: ${metrics.largestPositionPct.toFixed(1)}% of holdings.`,
    `Largest sector: ${metrics.largestSectorPct.toFixed(1)}% of holdings.`,
    `Estimated weighted daily volatility from demo price series: ${weightedVolatility.toFixed(1)}%.`,
    `${tradesLast30Days} paper trades in the past 30 days.`,
  ];
  return { score, label: score >= 60 ? "High" as const : score >= 30 ? "Moderate" as const : "Low" as const, reasons };
}

export function csvCell(value: string | number) {
  // Spreadsheet apps evaluate cells beginning with these characters as formulas.
  const raw = String(value);
  const text = /^\s*[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: (string | number)[][]) {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
