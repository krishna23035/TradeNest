import { useSymbol } from "@/contexts/SymbolContext";
import { useStock } from "@/hooks/useStock";
import { DecisionCard } from "@/components/DecisionCard";
import { AIRationale } from "@/components/AIRationale";
import { AlertsPanel } from "@/components/AlertsPanel";
import { Brain, BookOpen } from "lucide-react";

export default function AIInsights() {
  const { symbol } = useSymbol();
  const analysis = useStock(symbol);

  // Rule-based explanations
  const ma100 = analysis.sma100.at(-1);
  const ma200 = analysis.sma200.at(-1);
  const rsi = analysis.rsiSeries.at(-1);
  const macdHist = analysis.macdRes.hist.at(-1);

  const rules: { tone: "bull" | "bear" | "warn"; text: string }[] = [];
  if (ma100 && ma200) {
    if (ma100 > ma200) rules.push({ tone: "bull", text: `MA100 (${ma100.toFixed(2)}) is above MA200 (${ma200.toFixed(2)}) → golden-cross style bullish trend.` });
    else rules.push({ tone: "bear", text: `MA100 (${ma100.toFixed(2)}) is below MA200 (${ma200.toFixed(2)}) → death-cross style bearish trend.` });
  }
  if (rsi != null) {
    if (rsi > 70) rules.push({ tone: "bear", text: `RSI ${rsi.toFixed(1)} indicates overbought conditions → potential pullback.` });
    else if (rsi < 30) rules.push({ tone: "bull", text: `RSI ${rsi.toFixed(1)} indicates oversold conditions → potential rebound.` });
    else rules.push({ tone: "warn", text: `RSI ${rsi.toFixed(1)} sits in neutral zone (30–70).` });
  }
  if (macdHist != null) {
    if (macdHist > 0) rules.push({ tone: "bull", text: `MACD histogram positive (${macdHist.toFixed(2)}) → bullish momentum building.` });
    else rules.push({ tone: "bear", text: `MACD histogram negative (${macdHist.toFixed(2)}) → bearish momentum.` });
  }
  if (analysis.prediction.change > 0) {
    rules.push({ tone: "bull", text: `Rule-based trend projection suggests an upward move (+${analysis.prediction.change}% next session); no trained LSTM model is used.` });
  } else {
    rules.push({ tone: "bear", text: `Rule-based trend projection suggests a downward move (${analysis.prediction.change}% next session); no trained LSTM model is used.` });
  }
  if (analysis.vol > 3.5) rules.push({ tone: "warn", text: `Volatility elevated at ${analysis.vol}% → size positions conservatively.` });

  return (
    <div className="space-y-5">
      <header>
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-primary">
          <Brain className="h-3.5 w-3.5" /> Decision support
        </div>
        <h2 className="mt-1 font-mono text-3xl font-bold">{symbol}</h2>
        <div className="text-sm text-muted-foreground">Rule-based explanations + optional LLM rationale · {analysis.isLive ? "Yahoo historical prices" : "deterministic demo prices"}</div>
      </header>

      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 xl:col-span-6 space-y-5">
          <DecisionCard analysis={analysis} symbol={symbol} />
          <AIRationale analysis={analysis} symbol={symbol} />
        </div>
        <div className="col-span-12 xl:col-span-6 space-y-5">
          <div className="rounded-xl border border-border bg-card p-5 shadow-card">
            <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
              <BookOpen className="h-3.5 w-3.5" /> Rationale (rule-based)
            </div>
            <ul className="space-y-2">
              {rules.map((r, i) => (
                <li key={i} className={`flex gap-3 rounded-lg border p-3 text-sm ${
                  r.tone === "bull" ? "border-bull/40 bg-bull/5" :
                  r.tone === "bear" ? "border-bear/40 bg-bear/5" : "border-warn/40 bg-warn/5"
                }`}>
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                    r.tone === "bull" ? "bg-bull" : r.tone === "bear" ? "bg-bear" : "bg-warn"
                  }`} />
                  <span className="leading-relaxed">{r.text}</span>
                </li>
              ))}
            </ul>
          </div>
          <AlertsPanel analysis={analysis} symbol={symbol} />
        </div>
      </div>
    </div>
  );
}
