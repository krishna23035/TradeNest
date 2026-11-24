import Decimal from "decimal.js";
import type { Tables } from "@/integrations/supabase/types";
import { portfolioMetrics } from "@/lib/paperMath";
import { toCsv } from "@/lib/paperMath";
import { gainLossSummary, portfolioValuationHistory } from "@/lib/paperAnalytics";

export type ReportKind = "PORTFOLIO" | "TRADE" | "STATEMENT" | "PROFIT_LOSS";
export type ReportFormat = "csv" | "pdf";
export type ReportData = {
  holdings: Tables<"holdings">[];
  stocks: Tables<"stocks">[];
  orders: Tables<"orders">[];
  transactions: Tables<"transactions">[];
  quotes: Tables<"paper_quote_history">[];
  wallet: Tables<"wallets">;
};
export type DateRange = { from?: string; to?: string };
export type ReportDocument = {
  title: string;
  subtitle: string;
  headers: string[];
  rows: string[][];
  summary: string[];
};

const money = (value: Decimal.Value) => new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
const timestamp = (value: string | null) => value ? new Date(value).toISOString().slice(0, 19).replace("T", " ") + " UTC" : "";

function dateBoundary(value: string, exclusiveEnd: boolean) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Enter a valid report date");
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value)
    throw new Error("Enter a valid report date");
  return date.getTime() + (exclusiveEnd ? 86400000 : 0);
}

export function validateDateRange(range: DateRange) {
  const from = range.from ? dateBoundary(range.from, false) : -Infinity;
  const to = range.to ? dateBoundary(range.to, true) : Infinity;
  if (from >= to) throw new Error("Report start date must be on or before end date");
  return { from, to };
}

function within(time: string, range: { from: number; to: number }) {
  const value = Date.parse(time);
  return Number.isFinite(value) && value >= range.from && value < range.to;
}

export function buildPaperReport(kind: ReportKind, data: ReportData, dates: DateRange = {}): ReportDocument {
  const range = validateDateRange(dates);
  const period = dates.from || dates.to ? `UTC activity dates: ${dates.from || "beginning"} to ${dates.to || "latest"}` : "All recorded activity";
  const stockBySymbol = new Map(data.stocks.map((stock) => [stock.symbol, stock]));
  const positions = data.holdings.map((holding) => {
    const stock = stockBySymbol.get(holding.symbol);
    return {
      symbol: holding.symbol,
      sector: stock?.sector ?? "Unknown",
      quantity: holding.quantity,
      avgPrice: holding.avg_price,
      costBasis: holding.cost_basis,
      lastPrice: stock?.last_price ?? holding.avg_price,
      realizedPl: holding.realized_pl,
    };
  });
  const metrics = portfolioMetrics(positions);
  const currentSubtitle = "Current paper account snapshot; values use current recorded simulated quotes, in virtual credits";

  if (kind === "PORTFOLIO" || kind === "PROFIT_LOSS") {
    const headers = kind === "PORTFOLIO"
      ? ["Symbol", "Sector", "Qty", "Cost basis", "Quote", "Value", "Unrealized P/L"]
      : ["Symbol", "Qty", "Cost basis", "Value", "Realized P/L", "Unrealized P/L", "Total P/L"];
    const rows = positions.map((position) => {
      const value = new Decimal(position.lastPrice).times(position.quantity);
      const unrealized = value.minus(position.costBasis);
      return kind === "PORTFOLIO"
        ? [position.symbol, position.sector, String(position.quantity), money(position.costBasis), money(position.lastPrice), money(value), money(unrealized)]
        : [position.symbol, String(position.quantity), money(position.costBasis), money(value), money(position.realizedPl), money(unrealized), money(new Decimal(position.realizedPl).plus(unrealized))];
    });
    const summary = [
      `Holdings value: ${money(metrics.value)}`,
      `Cost basis: ${money(metrics.cost)}`,
      `Realized P/L: ${money(metrics.realizedPl)}`,
      `Unrealized P/L: ${money(metrics.unrealizedPl)}`,
      `Total P/L: ${money(new Decimal(metrics.realizedPl).plus(metrics.unrealizedPl))}`,
      `Available / reserved virtual credits: ${money(data.wallet.available_balance)} / ${money(data.wallet.blocked_balance)}`,
    ];
    if (kind === "PROFIT_LOSS") {
      const history = portfolioValuationHistory(data.orders, data.quotes).filter((point) => within(point.time, range));
      const historical = gainLossSummary(history);
      summary.push(historical
        ? `Recorded event period ${timestamp(historical.from)} to ${timestamp(historical.to)}; first/last holdings value ${money(historical.firstValue)} / ${money(historical.lastValue)}; change in cumulative P/L ${money(historical.change)}`
        : "No recorded valuation events in selected date range");
    }
    return { title: kind === "PORTFOLIO" ? "Paper portfolio holdings" : "Paper profit and loss", subtitle: kind === "PORTFOLIO" ? currentSubtitle : `${currentSubtitle}. ${period}`, headers, rows, summary };
  }

  if (kind === "TRADE") {
    const selected = data.orders.filter((order) => within(order.created_at, range));
    const buys = selected.filter((order) => order.side === "BUY" && order.status === "EXECUTED")
      .reduce((sum, order) => sum.plus(new Decimal(order.executed_price ?? 0).times(order.quantity)), new Decimal(0));
    const sells = selected.filter((order) => order.side === "SELL" && order.status === "EXECUTED")
      .reduce((sum, order) => sum.plus(new Decimal(order.executed_price ?? 0).times(order.quantity)), new Decimal(0));
    return {
      title: "Paper trading history",
      subtitle: `${period}; prices and amounts are virtual credits`,
      headers: ["Created UTC", "Symbol", "Side", "Kind", "Qty", "Status", "Executed UTC", "Price", "Gross"],
      rows: selected.map((order) => [timestamp(order.created_at), order.symbol, order.side, order.order_kind,
        String(order.quantity), order.status, timestamp(order.executed_at),
        order.executed_price === null ? "" : money(order.executed_price),
        order.executed_price === null ? "" : money(new Decimal(order.executed_price).times(order.quantity))]),
      summary: [`Orders: ${selected.length}`, `Executed BUY gross: ${money(buys)}`, `Executed SELL gross: ${money(sells)}`],
    };
  }

  const selected = data.transactions.filter((transaction) => within(transaction.created_at, range));
  const deposits = selected.filter((transaction) => transaction.txn_type === "VIRTUAL_DEPOSIT")
    .reduce((sum, transaction) => sum.plus(transaction.amount), new Decimal(0));
  const withdrawals = selected.filter((transaction) => transaction.txn_type === "VIRTUAL_WITHDRAWAL")
    .reduce((sum, transaction) => sum.plus(transaction.amount), new Decimal(0));
  return {
    title: "Paper wallet transactions",
    subtitle: `${period}; all amounts are virtual credits`,
    headers: ["Time UTC", "Type", "Order ID", "Amount", "Balance after"],
    rows: selected.map((transaction) => [timestamp(transaction.created_at), transaction.txn_type,
      transaction.order_id ?? "", money(transaction.amount), money(transaction.balance_after)]),
    summary: [`Transactions: ${selected.length}`, `Virtual deposits: ${money(deposits)}`,
      `Virtual withdrawals: ${money(withdrawals)}`, `Current available balance: ${money(data.wallet.available_balance)}`],
  };
}

export function reportCsv(document: ReportDocument) {
  return "\uFEFF" + toCsv([
    document.headers,
    ...document.rows,
    [],
    ...document.summary.map((line) => [line]),
    [document.subtitle],
  ]);
}

export async function reportPdf(document: ReportDocument): Promise<Uint8Array> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 32;
  const width = pdf.internal.pageSize.getWidth() - margin * 2;
  const bottom = pdf.internal.pageSize.getHeight() - margin;
  let y = margin;
  const lineHeight = 10;

  const pageBreak = (height: number) => {
    if (y + height <= bottom) return;
    pdf.addPage();
    y = margin;
  };
  const paragraph = (text: string, size = 9, gap = 8) => {
    pdf.setFontSize(size);
    const lines = pdf.splitTextToSize(text, width) as string[];
    const height = lines.length * (size + 3) + gap;
    pageBreak(height);
    pdf.text(lines, margin, y + size);
    y += height;
  };
  paragraph(document.title, 17, 5);
  paragraph(document.subtitle, 9, 13);
  const columnWidth = width / document.headers.length;
  const drawRow = (cells: string[], header = false) => {
    pdf.setFont("helvetica", header ? "bold" : "normal");
    pdf.setFontSize(7.5);
    const wrapped = cells.map((cell) => pdf.splitTextToSize(cell.length > 160 ? `${cell.slice(0, 157)}...` : cell || " ", columnWidth - 7) as string[]);
    const height = Math.max(...wrapped.map((lines) => lines.length)) * lineHeight + 7;
    if (y + height > bottom) {
      pdf.addPage();
      y = margin;
      if (!header) drawRow(document.headers, true);
    }
    wrapped.forEach((lines, index) => pdf.text(lines, margin + index * columnWidth + 3, y + 9));
    pdf.setDrawColor(210, 215, 225);
    pdf.line(margin, y + height, margin + width, y + height);
    y += height;
  };
  drawRow(document.headers, true);
  for (const row of document.rows) drawRow(row);
  y += 12;
  pdf.setFont("helvetica", "normal");
  for (const line of document.summary) paragraph(line, 9, 3);
  paragraph("TradeNest educational paper trading. No real-money transactions.", 8, 0);
  return new Uint8Array(pdf.output("arraybuffer"));
}
