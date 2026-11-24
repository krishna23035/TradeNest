import { useSymbol } from "@/contexts/SymbolContext";
import { useStock } from "@/hooks/useStock";
import { findAsset } from "@/lib/market";
import { PriceChart, MiniIndicatorChart } from "@/components/PriceChart";
import { DecisionCard } from "@/components/DecisionCard";
import { ReportButton } from "@/components/ReportButton";
import { Loader2, BarChart3, Sparkles, TrendingUp, TrendingDown, Activity, type LucideIcon } from "lucide-react";
import { useState } from "react";

export default function Dashboard() {
  const { symbol, setSymbol } = useSymbol();
  const analysis = useStock(symbol);
  const stock = findAsset(symbol);
  const last = analysis.last;
  const up = analysis.changePct >= 0;
  const [chartType, setChartType] = useState<"candle" | "line">("candle");

  if (!stock) return null;

  return (
    <div className="space-y-5">
      <section className="fade-up flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="font-mono text-3xl font-bold">{stock.symbol}</h2>
            <span className="rounded-md border border-border bg-secondary/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {stock.exchange} · {stock.sector}
            </span>
            {analysis.loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">{stock.name}</div>
        </div>
        <div className="flex items-center gap-3">
          <ReportButton analysis={analysis} symbol={symbol} />
          <div className="text-right">
            <div className="font-mono text-4xl font-semibold tabular">{last.close.toFixed(2)}</div>
            <div className={`font-mono text-sm tabular ${up ? "text-bull" : "text-bear"}`}>
              {up ? "▲" : "▼"} {Math.abs(analysis.changePct)}% today
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <SummaryCard label="Current price" value={last.close.toFixed(2)} icon={Activity} />
        <SummaryCard
          label="Change %"
          value={`${up ? "+" : ""}${analysis.changePct}%`}
          tone={up ? "bull" : "bear"}
          icon={up ? TrendingUp : TrendingDown}
        />
        <SummaryCard
          label="Trend"
          value={analysis.decision.action === "BUY" ? "Bullish" : analysis.decision.action === "SELL" ? "Bearish" : "Neutral"}
          tone={analysis.decision.action === "BUY" ? "bull" : analysis.decision.action === "SELL" ? "bear" : "warn"}
          icon={Sparkles}
        />
        <SummaryCard label="Volatility (20d)" value={`${analysis.vol}%`} icon={BarChart3} />
      </section>

      <section className="grid grid-cols-12 gap-5">
        <div className="col-span-12 xl:col-span-8 space-y-5">
          <div className="rounded-xl border border-border gradient-surface p-5 shadow-card fade-up">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
                <BarChart3 className="h-3.5 w-3.5" /> Price · MA100 / MA200 · heuristic projection
              </div>
              <div className="flex items-center gap-1 rounded-md border border-border bg-secondary/40 p-0.5 text-[11px]">
                <button onClick={() => setChartType("candle")} className={`px-2 py-1 rounded ${chartType === "candle" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Candle</button>
                <button onClick={() => setChartType("line")} className={`px-2 py-1 rounded ${chartType === "line" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Line</button>
              </div>
            </div>
            <PriceChart analysis={analysis} chartType={chartType} />
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-card fade-up">
            <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" /> Technical Indicators
            </div>
            <MiniIndicatorChart analysis={analysis} />
          </div>
        </div>

        <div className="col-span-12 xl:col-span-4 space-y-5">
          <DecisionCard analysis={analysis} symbol={symbol} />
          <RecommendationBadge action={analysis.decision.action} signalScore={analysis.decision.signalScore} />
        </div>
      </section>
    </div>
  );
}

function SummaryCard({ label, value, icon: Icon, tone }: { label: string; value: string; icon: LucideIcon; tone?: "bull" | "bear" | "warn" }) {
  const toneCls = tone === "bull" ? "text-bull" : tone === "bear" ? "text-bear" : tone === "warn" ? "text-warn" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className={`mt-2 font-mono text-2xl font-semibold tabular ${toneCls}`}>{value}</div>
    </div>
  );
}

function RecommendationBadge({ action, signalScore }: { action: "BUY" | "SELL" | "HOLD"; signalScore: number }) {
  const map = {
    BUY: "from-bull/30 to-bull/5 border-bull/40 text-bull",
    SELL: "from-bear/30 to-bear/5 border-bear/40 text-bear",
    HOLD: "from-warn/30 to-warn/5 border-warn/40 text-warn",
  } as const;
  return (
    <div className={`rounded-xl border bg-gradient-to-br p-5 shadow-card ${map[action]}`}>
      <div className="text-[10px] uppercase tracking-widest opacity-80">Quick recommendation</div>
      <div className="mt-1 font-mono text-3xl font-bold">{action}</div>
      <div className="text-xs opacity-80">Heuristic signal score {signalScore}/100 · not a probability</div>
    </div>
  );
}
