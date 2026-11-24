import { useStock, useCryptoSnapshot } from "@/hooks/useStock";
import { useSymbol } from "@/contexts/SymbolContext";
import { CRYPTOS, findAsset } from "@/lib/market";
import { PriceChart } from "@/components/PriceChart";
import { Bitcoin, Activity, ArrowUp, ArrowDown } from "lucide-react";
import { useEffect } from "react";

export default function Crypto() {
  const { symbol, setSymbol } = useSymbol();
  const snap = useCryptoSnapshot();

  // Default to a crypto symbol if user hasn't picked one
  useEffect(() => {
    if (!findAsset(symbol)?.kind) setSymbol("BTC-USD");
  }, []); // eslint-disable-line

  const activeSym = findAsset(symbol)?.kind === "crypto" ? symbol : "BTC-USD";
  const analysis = useStock(activeSym);
  const asset = findAsset(activeSym)!;
  const up = analysis.changePct >= 0;

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-primary">
            <Bitcoin className="h-3.5 w-3.5" /> Cryptocurrency
          </div>
          <h2 className="mt-1 font-mono text-3xl font-bold">{asset.symbol}</h2>
          <div className="text-sm text-muted-foreground">{asset.name}</div>
        </div>
        <div className="text-right">
          <div className="font-mono text-3xl font-semibold tabular">${analysis.last.close.toFixed(2)}</div>
          <div className={`font-mono text-sm ${up ? "text-bull" : "text-bear"}`}>
            {up ? "▲" : "▼"} {Math.abs(analysis.changePct)}%
          </div>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {snap.map((c) => {
          const cup = c.changePct >= 0;
          const active = c.symbol === activeSym;
          return (
            <button
              key={c.symbol}
              onClick={() => setSymbol(c.symbol)}
              className={`text-left rounded-xl border p-3 transition shadow-card ${
                active ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/40"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-semibold">{c.symbol}</span>
                <span className={`text-xs font-mono inline-flex items-center ${cup ? "text-bull" : "text-bear"}`}>
                  {cup ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                  {Math.abs(c.changePct).toFixed(2)}%
                </span>
              </div>
              <div className="mt-2 font-mono text-lg tabular">${c.last.toFixed(2)}</div>
              <div className="text-[11px] text-muted-foreground truncate">{c.name}</div>
            </button>
          );
        })}
      </section>

      <section className="rounded-xl border border-border gradient-surface p-5 shadow-card">
        <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
          <Activity className="h-3.5 w-3.5" /> {asset.symbol} {analysis.isLive ? "Yahoo history" : "demo history"}
        </div>
        <PriceChart analysis={analysis} chartType="candle" height={420} />
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Stat label="Volatility (20d)" value={`${analysis.vol}%`} tone={analysis.vol > 3.5 ? "bear" : analysis.vol > 1.8 ? "warn" : "bull"} />
        <Stat label="Trend signal" value={analysis.decision.action} tone={analysis.decision.action === "BUY" ? "bull" : analysis.decision.action === "SELL" ? "bear" : "warn"} />
        <Stat label="Heuristic next" value={`$${analysis.prediction.next.toFixed(2)}`} sub={`${analysis.prediction.change >= 0 ? "+" : ""}${analysis.prediction.change}% · not trained ML`} />
      </section>
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "bull" | "bear" | "warn" }) {
  const t = tone === "bull" ? "text-bull" : tone === "bear" ? "text-bear" : tone === "warn" ? "text-warn" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-1 font-mono text-2xl font-semibold ${t}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
