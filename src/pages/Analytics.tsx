import { useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ComposedChart, Line, LineChart,
  ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useSymbol } from "@/contexts/SymbolContext";
import { useStock } from "@/hooks/useStock";
import { PriceChart, ChartType } from "@/components/PriceChart";
import { BarChart3, Layers } from "lucide-react";

const CHART_TYPES: { id: ChartType; label: string }[] = [
  { id: "candle", label: "Candle" },
  { id: "line", label: "Line" },
  { id: "area", label: "Area" },
  { id: "bar", label: "Bar" },
  { id: "ohlc", label: "OHLC" },
  { id: "heikin", label: "Heikin Ashi" },
];

const PANELS = [
  { id: "close", label: "Closing Price" },
  { id: "ma100", label: "MA 100" },
  { id: "ma200", label: "MA 200" },
  { id: "volume", label: "Volume" },
  { id: "rsi", label: "RSI" },
  { id: "macd", label: "MACD" },
  { id: "prediction", label: "Prediction" },
] as const;

type PanelId = typeof PANELS[number]["id"];

export default function Analytics() {
  const { symbol } = useSymbol();
  const analysis = useStock(symbol);
  const [chartType, setChartType] = useState<ChartType>("candle");
  const [overlay, setOverlay] = useState(false);
  const [enabled, setEnabled] = useState<Record<PanelId, boolean>>({
    close: true, ma100: true, ma200: true, volume: true, rsi: true, macd: true, prediction: true,
  });

  const data = analysis.candles.map((c, i) => ({
    date: c.date,
    close: c.close,
    volume: c.volume,
    ma100: analysis.sma100[i],
    ma200: analysis.sma200[i],
    rsi: analysis.rsiSeries[i],
    macd: analysis.macdRes.line[i],
    signal: analysis.macdRes.signal[i],
    hist: analysis.macdRes.hist[i],
  }));

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-primary flex items-center gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" /> Analytics
          </div>
          <h2 className="mt-1 font-mono text-3xl font-bold">{symbol}</h2>
          <div className="text-sm text-muted-foreground">Toggleable indicators · multiple chart types</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-md border border-border bg-secondary/40 p-0.5 text-[11px]">
            {CHART_TYPES.map((t) => (
              <button key={t.id} onClick={() => setChartType(t.id)}
                className={`px-2 py-1 rounded ${chartType === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                {t.label}
              </button>
            ))}
          </div>
          <button onClick={() => setOverlay((v) => !v)}
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs ${overlay ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>
            <Layers className="h-3 w-3" /> Overlay mode
          </button>
        </div>
      </header>

      <div className="rounded-xl border border-border bg-card p-3 shadow-card">
        <div className="flex flex-wrap gap-2">
          {PANELS.map((p) => (
            <button key={p.id} onClick={() => setEnabled((s) => ({ ...s, [p.id]: !s[p.id] }))}
              className={`rounded-md border px-2 py-1 text-xs ${enabled[p.id] ? "border-primary/60 bg-primary/15 text-primary" : "border-border text-muted-foreground"}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {overlay ? (
        <div className="rounded-xl border border-border gradient-surface p-5 shadow-card">
          <div className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">All-in-one overlay</div>
          <PriceChart analysis={analysis} chartType={chartType} height={460}
            showMA={enabled.ma100 || enabled.ma200} showPrediction={enabled.prediction} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {enabled.close && (
            <Panel title="Closing Price">
              <PriceChart analysis={analysis} chartType={chartType} height={260} showMA={false} showPrediction={enabled.prediction} />
            </Panel>
          )}
          {enabled.ma100 && (
            <Panel title="MA 100 vs Price">
              <SmallLine data={data} keys={[
                { dataKey: "close", color: "var(--primary)", name: "Close" },
                { dataKey: "ma100", color: "var(--accent)", name: "MA 100" },
              ]} />
            </Panel>
          )}
          {enabled.ma200 && (
            <Panel title="MA 200 vs Price">
              <SmallLine data={data} keys={[
                { dataKey: "close", color: "var(--primary)", name: "Close" },
                { dataKey: "ma200", color: "var(--warn)", name: "MA 200" },
              ]} />
            </Panel>
          )}
          {enabled.volume && (
            <Panel title="Volume">
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 6" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickFormatter={(v) => v.slice(5)} minTickGap={30} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} width={50} tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="volume" fill="hsl(var(--accent))" opacity={0.7} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          )}
          {enabled.rsi && (
            <Panel title="RSI (14)">
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 6" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickFormatter={(v) => v.slice(5)} minTickGap={30} />
                    <YAxis domain={[0, 100]} ticks={[30, 50, 70]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} width={36} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <ReferenceLine y={70} stroke="hsl(var(--bear))" strokeDasharray="3 3" />
                    <ReferenceLine y={30} stroke="hsl(var(--bull))" strokeDasharray="3 3" />
                    <Line type="monotone" dataKey="rsi" stroke="hsl(var(--primary))" dot={false} strokeWidth={1.5} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          )}
          {enabled.macd && (
            <Panel title="MACD">
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={data}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 6" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickFormatter={(v) => v.slice(5)} minTickGap={30} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} width={36} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="hist" isAnimationActive={false}
                      shape={(p: { x: number; y: number; width: number; height: number; payload?: { hist?: number } }) => (
                        <rect x={p.x} y={p.y} width={p.width} height={p.height}
                          fill={(p.payload?.hist ?? 0) >= 0 ? "hsl(var(--bull))" : "hsl(var(--bear))"} />
                      )}
                    />
                    <Line type="monotone" dataKey="macd" stroke="hsl(var(--primary))" dot={false} strokeWidth={1.5} />
                    <Line type="monotone" dataKey="signal" stroke="hsl(var(--accent))" dot={false} strokeWidth={1.2} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          )}
          {enabled.prediction && (
            <Panel title="LSTM Prediction (statistical proxy)">
              <div className="space-y-3">
                <div className="flex items-end justify-between rounded-lg border border-primary/40 bg-primary/5 p-4">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-primary">Heuristic next session · not trained ML</div>
                    <div className="font-mono text-3xl font-bold">{analysis.prediction.next.toFixed(2)}</div>
                  </div>
                  <div className={`text-right font-mono text-lg ${analysis.prediction.change >= 0 ? "text-bull" : "text-bear"}`}>
                    {analysis.prediction.change >= 0 ? "+" : ""}{analysis.prediction.change}%
                  </div>
                </div>
                <div className="h-[160px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.slice(-60)}>
                      <defs>
                        <linearGradient id="predFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 6" vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickFormatter={(v) => v.slice(5)} minTickGap={30} />
                      <YAxis domain={["auto", "auto"]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} width={50} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Area type="monotone" dataKey="close" stroke="hsl(var(--primary))" fill="url(#predFill)" strokeWidth={1.5} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </Panel>
          )}
        </div>
      )}
    </div>
  );
}

const tooltipStyle = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
};

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}

function SmallLine({ data, keys }: { data: Record<string, string | number | null | undefined>[]; keys: { dataKey: string; color: string; name: string }[] }) {
  return (
    <div className="h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 6" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickFormatter={(v) => v.slice(5)} minTickGap={30} />
          <YAxis domain={["auto", "auto"]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} width={50} />
          <Tooltip contentStyle={tooltipStyle} />
          {keys.map((k) => (
            <Line key={k.dataKey} type="monotone" dataKey={k.dataKey} stroke={`hsl(${k.color})`} dot={false} strokeWidth={1.6} name={k.name} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
