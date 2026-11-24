import { Activity, Brain, ShieldAlert, TrendingDown, TrendingUp } from "lucide-react";
import type { Analysis } from "@/hooks/useStock";

interface Props { analysis: Analysis; symbol: string; }

const actionStyle = {
  BUY:  { ring: "border-bull/60 bg-bull/10",  text: "text-bull",  Icon: TrendingUp,   chip: "bg-bull text-primary-foreground" },
  SELL: { ring: "border-bear/60 bg-bear/10",  text: "text-bear",  Icon: TrendingDown, chip: "bg-bear text-foreground" },
  HOLD: { ring: "border-warn/60 bg-warn/10",  text: "text-warn",  Icon: Activity,     chip: "bg-warn text-primary-foreground" },
} as const;

const riskStyle = {
  Low:    "text-bull bg-bull/10 border-bull/30",
  Medium: "text-warn bg-warn/10 border-warn/30",
  High:   "text-bear bg-bear/10 border-bear/30",
} as const;

export function DecisionCard({ analysis, symbol }: Props) {
  const { decision, prediction, last, vol } = analysis;
  const a = actionStyle[decision.action];
  const Icon = a.Icon;
  const predUp = prediction.change >= 0;

  return (
    <div className={`relative overflow-hidden rounded-xl border p-5 shadow-card ${a.ring}`}>
      <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-primary/5 blur-3xl" />
      <div className="relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <Brain className="h-3.5 w-3.5" /> Rule-based decision engine
          </div>
          <span className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${riskStyle[decision.risk]}`}>
            <ShieldAlert className="-mt-0.5 mr-1 inline h-3 w-3" />
            {decision.risk} risk
          </span>
        </div>

        <div className="mt-4 flex items-end gap-4">
          <Icon className={`h-12 w-12 ${a.text}`} strokeWidth={1.6} />
          <div>
            <div className={`font-mono text-5xl font-bold leading-none ${a.text}`}>{decision.action}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              for <span className="font-mono text-foreground">{symbol}</span> · heuristic signal score{" "}
              <span className="font-mono text-foreground">{decision.signalScore}/100</span>
            </div>
          </div>
        </div>

        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div className={`h-full ${a.chip}`} style={{ width: `${decision.signalScore}%` }} />
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3 text-center">
          <Metric label="Current" value={`₹${last.close.toFixed(2)}`} />
          <Metric
            label="Heuristic next"
            value={`₹${prediction.next.toFixed(2)}`}
            sub={`${predUp ? "+" : ""}${prediction.change}%`}
            subTone={predUp ? "bull" : "bear"}
          />
          <Metric label="Volatility" value={`${vol}%`} sub="20-day σ" />
        </div>

        <ul className="mt-4 space-y-1.5">
          {decision.reasons.slice(0, 4).map((r, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Metric({
  label, value, sub, subTone,
}: { label: string; value: string; sub?: string; subTone?: "bull" | "bear" }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/40 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-base font-semibold tabular">{value}</div>
      {sub && (
        <div className={`text-[11px] font-mono ${subTone === "bull" ? "text-bull" : subTone === "bear" ? "text-bear" : "text-muted-foreground"}`}>
          {sub}
        </div>
      )}
    </div>
  );
}
