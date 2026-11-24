import { useMemo } from "react";
import { useSymbol } from "@/contexts/SymbolContext";
import { useStock } from "@/hooks/useStock";
import { compareModels, type ModelResult } from "@/lib/market";
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis, Legend,
} from "recharts";
import { GitCompare } from "lucide-react";

const tooltipStyle = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
};

export default function ModelComparison() {
  const { symbol } = useSymbol();
  const analysis = useStock(symbol);
  const results = useMemo(() => compareModels(analysis.candles, 60), [analysis.candles]);

  const best = [...results].sort((a, b) => a.rmse - b.rmse)[0];

  // Combine predictions for one chart
  const merged = results[0].predictions.map((p, i) => {
    const row: Record<string, string | number | null> = { date: p.date, actual: p.actual };
    results.forEach((r) => { row[r.name] = r.predictions[i]?.predicted ?? null; });
    return row;
  });

  const colors: Record<string, string> = {
    "LSTM proxy": "var(--primary)",
    "Linear trend": "var(--accent)",
    "Median ensemble": "var(--warn)",
    "AR drift": "var(--bear)",
  };

  return (
    <div className="space-y-5">
      <header>
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-primary">
          <GitCompare className="h-3.5 w-3.5" /> Model Comparison
        </div>
        <h2 className="mt-1 font-mono text-3xl font-bold">{symbol}</h2>
        <div className="text-sm text-muted-foreground">
          Heuristic proxy backtest over last 60 sessions · {analysis.isLive ? "Yahoo historical prices" : "deterministic demo prices"} · No trained ML models · Best by RMSE: <span className="font-mono text-primary">{best.name}</span>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {results.map((r) => (
          <div key={r.name} className={`rounded-xl border p-4 shadow-card ${r.name === best.name ? "border-primary/60 bg-primary/5" : "border-border bg-card"}`}>
            <div className="text-xs font-semibold">{r.name}</div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <Metric label="MAE" value={r.mae.toFixed(2)} />
              <Metric label="RMSE" value={r.rmse.toFixed(2)} />
              <Metric label="Acc" value={`${r.accuracy}%`} />
            </div>
            <div className="mt-3 text-[11px] text-muted-foreground">
              Next: <span className="font-mono text-foreground">{r.nextPrediction.toFixed(2)}</span>
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-border bg-card p-5 shadow-card">
        <div className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Predicted vs Actual</div>
        <div className="h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={merged}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 6" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickFormatter={(v) => v.slice(5)} minTickGap={30} />
              <YAxis domain={["auto", "auto"]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} width={50} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="actual" stroke="hsl(var(--foreground))" strokeWidth={2} dot={false} name="Actual" />
              {results.map((r) => (
                <Line key={r.name} type="monotone" dataKey={r.name} stroke={`hsl(${colors[r.name] ?? "var(--primary)"})`}
                  strokeWidth={1.4} dot={false} strokeDasharray="4 3" />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2">
        <PerfBars title="RMSE (lower is better)" results={results} field="rmse" />
        <PerfBars title="Directional Accuracy %" results={results} field="accuracy" />
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-secondary/40 p-2">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-mono text-sm tabular">{value}</div>
    </div>
  );
}

function PerfBars({ title, results, field }: { title: string; results: ModelResult[]; field: "rmse" | "accuracy" }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">{title}</div>
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={results}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 6" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
            <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} width={42} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey={field} fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
