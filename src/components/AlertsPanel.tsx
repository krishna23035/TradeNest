import { Bell, TriangleAlert } from "lucide-react";
import type { Analysis } from "@/hooks/useStock";

export function AlertsPanel({ analysis, symbol }: { analysis: Analysis; symbol: string }) {
  const alerts: { tone: "bull" | "bear" | "warn"; title: string; body: string }[] = [];
  if (analysis.decision.action === "BUY" && analysis.decision.signalScore > 70) {
    alerts.push({ tone: "bull", title: `Strong BUY on ${symbol}`, body: `Heuristic signal score ${analysis.decision.signalScore}/100. Multiple indicators aligned.` });
  }
  if (analysis.decision.action === "SELL" && analysis.decision.signalScore > 70) {
    alerts.push({ tone: "bear", title: `Strong SELL on ${symbol}`, body: `Heuristic signal score ${analysis.decision.signalScore}/100. Bearish indicators dominate.` });
  }
  if (analysis.prediction.change < -1.5) {
    alerts.push({ tone: "bear", title: `${symbol} heuristic downside flag`, body: `Rule-based projection ${analysis.prediction.change}% next session; not a trained forecast.` });
  }
  if (analysis.vol > 3.5) {
    alerts.push({ tone: "warn", title: `Unusual volatility`, body: `20-day σ at ${analysis.vol}% — exercise caution. (SEBI risk flag)` });
  }
  const rsiLast = analysis.rsiSeries.at(-1);
  if (rsiLast && rsiLast > 75) {
    alerts.push({ tone: "warn", title: `RSI overbought`, body: `RSI at ${rsiLast.toFixed(1)} — potential pullback.` });
  }
  if (alerts.length === 0) {
    alerts.push({ tone: "warn", title: "No active alerts", body: "Markets are calm for this symbol right now." });
  }

  const tones = {
    bull: "border-bull/40 bg-bull/5",
    bear: "border-bear/40 bg-bear/5",
    warn: "border-warn/40 bg-warn/5",
  };
  const dots = { bull: "bg-bull", bear: "bg-bear", warn: "bg-warn" };

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
        <Bell className="h-3.5 w-3.5" /> Alerts
      </div>
      <ul className="mt-3 space-y-2">
        {alerts.map((a, i) => (
          <li key={i} className={`flex gap-3 rounded-lg border p-3 ${tones[a.tone]}`}>
            <span className={`pulse-dot mt-1.5 h-2 w-2 shrink-0 rounded-full ${dots[a.tone]}`} />
            <div>
              <div className="text-sm font-semibold">{a.title}</div>
              <div className="text-xs text-muted-foreground">{a.body}</div>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex items-start gap-2 rounded-lg border border-warn/40 bg-warn/5 p-3 text-[11px] text-muted-foreground">
        <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warn" />
        <span>
          <span className="font-semibold text-warn">SEBI investor notice:</span> This is not financial advice.
          Markets carry risk. Past performance does not guarantee future returns. Consult a registered advisor.
        </span>
      </div>
    </div>
  );
}
