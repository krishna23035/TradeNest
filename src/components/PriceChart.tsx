import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Analysis } from "@/hooks/useStock";
import { heikinAshi } from "@/lib/market";

interface Props { analysis: Analysis; }
type ShapeProps = {
  x: number; y: number; width: number; height: number;
  payload?: { open?: number; high?: number; low?: number; close?: number; hist?: number; isPrediction?: boolean };
  yAxis?: { scale: (value: number) => number };
};
type ChartPoint = {
  date: string; open?: number; high?: number; low?: number; close?: number; volume?: number;
  sma100?: number; sma200?: number; actual?: number; predicted?: number;
  isPrediction?: boolean; predictionChangePct?: number;
};

// Custom candle as a Bar shape — high/low wick + open/close body
const CandleShape = (props: Partial<ShapeProps>) => {
  const { x, width, payload, yAxis } = props;
  if (x === undefined || width === undefined || payload?.open === undefined || payload.high === undefined || payload.low === undefined || payload.close === undefined || !yAxis) return null;
  const scale = yAxis.scale;
  const isUp = payload.close >= payload.open;
  const color = isUp ? "hsl(var(--bull))" : "hsl(var(--bear))";
  const bodyTop = scale(Math.max(payload.open, payload.close));
  const bodyBottom = scale(Math.min(payload.open, payload.close));
  const wickTop = scale(payload.high);
  const wickBottom = scale(payload.low);
  const cx = x + width / 2;
  const bodyW = Math.max(2, width * 0.65);
  return (
    <g>
      <line x1={cx} x2={cx} y1={wickTop} y2={wickBottom} stroke={color} strokeWidth={1} />
      <rect
        x={cx - bodyW / 2}
        y={bodyTop}
        width={bodyW}
        height={Math.max(1, bodyBottom - bodyTop)}
        fill={color}
        opacity={isUp ? 0.95 : 0.9}
      />
    </g>
  );
};

// OHLC bar (tick chart): vertical wick, left tick = open, right tick = close
const OhlcShape = (props: Partial<ShapeProps>) => {
  const { x, width, payload, yAxis } = props;
  if (x === undefined || width === undefined || payload?.open === undefined || payload.high === undefined || payload.low === undefined || payload.close === undefined || !yAxis) return null;
  const scale = yAxis.scale;
  const isUp = payload.close >= payload.open;
  const color = isUp ? "hsl(var(--bull))" : "hsl(var(--bear))";
  const cx = x + width / 2;
  return (
    <g stroke={color} strokeWidth={1.2}>
      <line x1={cx} x2={cx} y1={scale(payload.high)} y2={scale(payload.low)} />
      <line x1={x} x2={cx} y1={scale(payload.open)} y2={scale(payload.open)} />
      <line x1={cx} x2={x + width} y1={scale(payload.close)} y2={scale(payload.close)} />
    </g>
  );
};

export type ChartType = "candle" | "line" | "area" | "bar" | "ohlc" | "heikin";

export function PriceChart({
  analysis,
  chartType = "candle",
  height = 380,
  showMA = true,
  showPrediction = true,
}: Props & { chartType?: ChartType; height?: number; showMA?: boolean; showPrediction?: boolean }) {
  const { candles, sma100, sma200, prediction } = analysis;
  const sourceCandles = chartType === "heikin" ? heikinAshi(candles) : candles;
  const data: ChartPoint[] = sourceCandles.map((c, i) => ({
    ...c,
    sma100: sma100[i],
    sma200: sma200[i],
    actual: c.close,
  }));
  const last = sourceCandles[sourceCandles.length - 1];

  let nextDate = "";
  if (last) {
    const d = new Date(last.date);
    d.setDate(d.getDate() + 1);
    nextDate = d.toISOString().slice(0, 10);
  }
  const predictionChangePct = last
    ? +(((prediction.next - last.close) / last.close) * 100).toFixed(2)
    : 0;

  if (showPrediction && last) {
    data[data.length - 1] = { ...data[data.length - 1], predicted: last.close };
    data.push({
      date: nextDate,
      predicted: prediction.next,
      isPrediction: true,
      predictionChangePct,
    });
  }

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.45} />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 6" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            tickFormatter={(v) => (v ? v.slice(5) : "")}
            minTickGap={40}
            stroke="hsl(var(--border))"
          />
          <YAxis
            domain={["auto", "auto"]}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            stroke="hsl(var(--border))"
            width={60}
            tickFormatter={(v) => v.toFixed(0)}
          />
          <Tooltip
            cursor={{ stroke: "hsl(var(--primary))", strokeOpacity: 0.3 }}
            content={(props: unknown) => {
              const { active, payload, label } = props as { active?: boolean; payload?: { payload?: ChartPoint }[]; label?: string };
              if (!active || !payload?.length) return null;
              const row: Partial<ChartPoint> = payload[0]?.payload ?? {};
              const isPred = !!row.isPrediction;
              return (
                <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-card">
                  <div className="text-muted-foreground">{label}{isPred && " · t+1"}</div>
                  {isPred ? (
                    <>
                      <div className="font-mono text-bull">Heuristic (Next Day): {Number(row.predicted).toFixed(2)}</div>
                      <div className={row.predictionChangePct >= 0 ? "text-bull" : "text-bear"}>
                        {row.predictionChangePct >= 0 ? "+" : ""}{row.predictionChangePct}%
                      </div>
                    </>
                  ) : (
                    <>
                      {typeof row.close === "number" && <div className="font-mono">Close: {row.close.toFixed(2)}</div>}
                      {typeof row.sma100 === "number" && <div className="text-accent">MA100: {row.sma100.toFixed(2)}</div>}
                      {typeof row.sma200 === "number" && <div className="text-warn">MA200: {row.sma200.toFixed(2)}</div>}
                    </>
                  )}
                </div>
              );
            }}
          />
          {(chartType === "candle" || chartType === "heikin") && (
            <Bar dataKey="close" shape={<CandleShape />} isAnimationActive={false} />
          )}
          {chartType === "ohlc" && (
            <Bar dataKey="close" shape={<OhlcShape />} isAnimationActive={false} />
          )}
          {chartType === "bar" && (
            <Bar dataKey="close" isAnimationActive={false}
              shape={(p: ShapeProps) => (
                <rect x={p.x + p.width * 0.15} y={p.y} width={p.width * 0.7} height={p.height}
                  fill={(p.payload?.close ?? 0) >= (p.payload?.open ?? 0) ? "hsl(var(--bull))" : "hsl(var(--bear))"} />
              )} />
          )}
          {chartType === "area" && (
            <Area type="monotone" dataKey="actual" stroke="hsl(var(--primary))" strokeWidth={2}
              fill="url(#areaFill)" dot={false} name={analysis.isLive ? "Yahoo historical price" : "Demo price series"} connectNulls />
          )}
          {chartType === "line" && (
            <Line type="monotone" dataKey="actual" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name={analysis.isLive ? "Yahoo historical price" : "Demo price series"} connectNulls />
          )}
          {showMA && (
            <>
              <Line type="monotone" dataKey="sma100" stroke="hsl(var(--accent))" strokeWidth={1.5} dot={false} name="MA 100" connectNulls />
              <Line type="monotone" dataKey="sma200" stroke="hsl(var(--warn))" strokeWidth={1.5} dot={false} name="MA 200" connectNulls />
            </>
          )}
          {showPrediction && (
            <Line
              type="linear"
              dataKey="predicted"
              stroke="hsl(var(--bull))"
              strokeWidth={2}
              strokeDasharray="5 5"
              name="Heuristic (Next Day)"
              dot={(props: unknown) => {
                const point = props as { payload?: ChartPoint; cx?: number; cy?: number };
                return point.payload?.isPrediction ? (
                  <circle cx={point.cx} cy={point.cy} r={6}
                    fill="hsl(var(--bull))" stroke="hsl(var(--background))" strokeWidth={2} />
                ) : <g />;
              }}
              activeDot={{ r: 7, fill: "hsl(var(--bull))" }}
              connectNulls
              isAnimationActive={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
      {showPrediction && last && (
        <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-primary" /> {analysis.isLive ? "Yahoo historical price" : "Demo price series"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-bull" /> Heuristic projection · {nextDate}
          </span>
          <span className={predictionChangePct >= 0 ? "text-bull" : "text-bear"}>
            {predictionChangePct >= 0 ? "▲" : "▼"} {Math.abs(predictionChangePct)}%
          </span>
        </div>
      )}
    </div>
  );
}

export function MiniIndicatorChart({ analysis }: Props) {
  const data = analysis.candles.map((c, i) => ({
    date: c.date,
    rsi: analysis.rsiSeries[i],
    hist: analysis.macdRes.hist[i],
  }));
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>RSI (14)</span>
          <span className="font-mono text-foreground">{analysis.rsiSeries.at(-1)?.toFixed(1) ?? "—"}</span>
        </div>
        <div className="h-24">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 2, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 6" vertical={false} />
              <XAxis dataKey="date" hide />
              <YAxis domain={[0, 100]} ticks={[30, 70]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} width={28} />
              <Line type="monotone" dataKey="rsi" stroke="hsl(var(--primary))" strokeWidth={1.5} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>MACD histogram</span>
          <span className="font-mono text-foreground">{analysis.macdRes.hist.at(-1)?.toFixed(2) ?? "—"}</span>
        </div>
        <div className="h-24">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 2, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 6" vertical={false} />
              <XAxis dataKey="date" hide />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} width={28} />
              <Bar dataKey="hist" isAnimationActive={false}
                shape={(p: ShapeProps) => (
                  <rect x={p.x} y={p.y} width={p.width} height={p.height}
                    fill={(p.payload?.hist ?? 0) >= 0 ? "hsl(var(--bull))" : "hsl(var(--bear))"} />
                )}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
