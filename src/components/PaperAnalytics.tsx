import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Tables } from "@/integrations/supabase/types";
import { gainLossSummary, portfolioValuationHistory } from "@/lib/paperAnalytics";
import { portfolioMetrics } from "@/lib/paperMath";

type Props = {
  holdings: Tables<"holdings">[];
  stocks: Tables<"stocks">[];
  orders: Tables<"orders">[];
  quotes: Tables<"paper_quote_history">[];
  loading: boolean;
  error: string;
};

const colors = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--warn))", "hsl(var(--bull))", "hsl(var(--bear))"];
const tooltipStyle = { background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 };

export function PaperAnalytics({ holdings, stocks, orders, quotes, loading, error }: Props) {
  const positions = holdings.map((holding) => {
    const stock = stocks.find((item) => item.symbol === holding.symbol);
    return { symbol: holding.symbol, sector: stock?.sector ?? "Unknown", quantity: holding.quantity,
      avgPrice: holding.avg_price, costBasis: holding.cost_basis,
      lastPrice: stock?.last_price ?? holding.avg_price, realizedPl: holding.realized_pl };
  });
  const metrics = portfolioMetrics(positions);
  const valuation = useMemo(() => {
    try { return { points: portfolioValuationHistory(orders, quotes), error: "" }; }
    catch (cause) { return { points: [], error: cause instanceof Error ? cause.message : "History unavailable" }; }
  }, [orders, quotes]);
  const history = valuation.points;
  const summary = gainLossSummary(history);
  const sectorData = Object.entries(metrics.sectorTotals).map(([name, value]) => ({ name, value }));
  const holdingData = positions.filter((position) => position.quantity > 0)
    .map((position) => ({ name: position.symbol, value: position.quantity * position.lastPrice }));
  const plData = [
    { name: "Realized", amount: metrics.realizedPl },
    { name: "Unrealized", amount: metrics.unrealizedPl },
  ];

  return <section className="rounded-xl border border-border bg-card p-5 shadow-card">
    <h3 className="font-semibold">Paper portfolio analytics</h3>
    <p className="mt-1 text-xs text-muted-foreground">
      Historical points use executed paper orders and recorded simulated quote changes only. No daily values are interpolated.
    </p>
    {loading && <p className="mt-3 text-xs text-muted-foreground">Loading recorded account history…</p>}
    {(error || valuation.error) && <p role="alert" className="mt-3 text-xs text-bear">{error || valuation.error}</p>}
    {!loading && !error && !valuation.error && <>
      {summary ? <div className="mt-4 grid gap-3 text-xs md:grid-cols-4">
        <div>First recorded value <strong className="block font-mono text-sm">{summary.firstValue.toFixed(2)}</strong></div>
        <div>Latest recorded value <strong className="block font-mono text-sm">{summary.lastValue.toFixed(2)}</strong></div>
        <div>Change in cumulative P/L <strong className="block font-mono text-sm">{summary.change.toFixed(2)}</strong></div>
        <div>Recorded value range <strong className="block font-mono text-sm">{summary.lowestValue.toFixed(2)}–{summary.highestValue.toFixed(2)}</strong></div>
      </div> : <p className="mt-3 text-xs text-muted-foreground">No executed paper orders or recorded valuation events yet.</p>}
      {history.length > 0 && <div className="mt-4 h-64" aria-label="Historical paper holdings value and cumulative profit or loss">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={history}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 6" vertical={false} />
            <XAxis dataKey="time" tickFormatter={(value: string) => value.slice(5, 16).replace("T", " ")} tick={{ fontSize: 10 }} minTickGap={32} />
            <YAxis tick={{ fontSize: 10 }} width={60} />
            <Tooltip contentStyle={tooltipStyle} labelFormatter={(value) => new Date(String(value)).toLocaleString()} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line dataKey="value" name="Holdings value" stroke="hsl(var(--primary))" dot={history.length < 30} connectNulls={false} />
            <Line dataKey="totalPl" name="Cumulative P/L" stroke="hsl(var(--bull))" dot={history.length < 30} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>}
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <div><h4 className="text-xs font-semibold">Sector allocation · simulated value</h4>
          {sectorData.length ? <div className="h-48"><ResponsiveContainer width="100%" height="100%"><PieChart>
            <Pie data={sectorData} dataKey="value" nameKey="name" outerRadius={65} label>{sectorData.map((entry, index) => <Cell key={entry.name} fill={colors[index % colors.length]} />)}</Pie>
            <Tooltip contentStyle={tooltipStyle} /></PieChart></ResponsiveContainer></div>
            : <p className="mt-3 text-xs text-muted-foreground">No holdings.</p>}</div>
        <div><h4 className="text-xs font-semibold">Holdings distribution · simulated value</h4>
          {holdingData.length ? <div className="h-48"><ResponsiveContainer width="100%" height="100%"><PieChart>
            <Pie data={holdingData} dataKey="value" nameKey="name" outerRadius={65} label>{holdingData.map((entry, index) => <Cell key={entry.name} fill={colors[index % colors.length]} />)}</Pie>
            <Tooltip contentStyle={tooltipStyle} /></PieChart></ResponsiveContainer></div>
            : <p className="mt-3 text-xs text-muted-foreground">No holdings.</p>}</div>
        <div><h4 className="text-xs font-semibold">Current profit and loss · virtual credits</h4>
          <div className="h-48"><ResponsiveContainer width="100%" height="100%"><BarChart data={plData}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 6" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} width={55} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="amount" name="P/L">{plData.map((item) => <Cell key={item.name} fill={item.amount >= 0 ? "hsl(var(--bull))" : "hsl(var(--bear))"} />)}</Bar>
          </BarChart></ResponsiveContainer></div></div>
      </div>
    </>}
  </section>;
}
