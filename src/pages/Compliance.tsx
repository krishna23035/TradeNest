import { ShieldAlert, AlertTriangle, BookOpen, Scale, Activity, CheckCircle2 } from "lucide-react";
import { useSymbol } from "@/contexts/SymbolContext";
import { useStock } from "@/hooks/useStock";

const PRINCIPLES = [
  { t: "Investments are subject to market risks", d: "Past performance is not indicative of future results. Read all related documents carefully." },
  { t: "Educational use only", d: "TradeNest Pro+ is a decision-support and learning platform. It does not provide personalized investment advice." },
  { t: "No guaranteed returns", d: "AI predictions and technical signals are probabilistic — they can and do fail. Diversify and never invest more than you can afford to lose." },
  { t: "Verify before acting", d: "Cross-check signals with company fundamentals, official disclosures (BSE/NSE filings), and certified financial advisors." },
];

const RIGHTS = [
  "Right to fair, transparent and equitable treatment",
  "Right to be informed about products & services",
  "Right to suitability — products matching risk profile",
  "Right to privacy of personal information",
  "Right to grievance redressal & compensation",
];

function riskClass(level: "Low" | "Medium" | "High") {
  if (level === "High") return "text-bear bg-bear/10 border-bear/30";
  if (level === "Medium") return "text-warn bg-warn/10 border-warn/30";
  return "text-bull bg-bull/10 border-bull/30";
}

export default function Compliance() {
  const { symbol } = useSymbol();
  const a = useStock(symbol);
  const vol = a.vol;
  const risk = a.decision.risk;
  const highVol = vol > 3.5;

  return (
    <div className="space-y-5">
      <header>
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-primary">
          <Scale className="h-3.5 w-3.5" /> Regulatory & SEBI Compliance
        </div>
        <h2 className="mt-1 font-mono text-3xl font-bold">Responsible investing</h2>
        <div className="text-sm text-muted-foreground">
          Our commitment to transparency, risk disclosure, and investor protection.
        </div>
      </header>

      {/* Hero disclaimer */}
      <section className="rounded-xl border border-warn/30 bg-warn/5 p-5">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 text-warn shrink-0" />
          <div>
            <div className="font-semibold">Important risk disclosure</div>
            <p className="mt-1 text-sm text-muted-foreground">
              <strong className="text-foreground">Investments in securities market are subject to market risks.</strong>{" "}
              Read all the related documents carefully before investing. The content on this platform is for educational
              and informational purposes only and does not constitute investment, legal, or tax advice.
            </p>
          </div>
        </div>
      </section>

      {/* Live risk for active symbol */}
      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-card/40 p-4">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Active symbol</div>
          <div className="mt-1 font-mono text-xl font-bold">{symbol}</div>
          <div className="text-xs text-muted-foreground">Current ₹/$ {a.last?.close.toFixed(2)}</div>
        </div>
        <div className={`rounded-xl border p-4 ${riskClass(risk)}`}>
          <div className="text-[10px] uppercase tracking-widest opacity-80">Risk level</div>
          <div className="mt-1 flex items-center gap-2 text-xl font-bold">
            <AlertTriangle className="h-5 w-5" /> {risk}
          </div>
          <div className="text-xs opacity-80">Based on signal strength & volatility</div>
        </div>
        <div className={`rounded-xl border p-4 ${highVol ? "border-bear/30 bg-bear/5 text-bear" : "border-border bg-card/40"}`}>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">20-day volatility</div>
          <div className="mt-1 flex items-center gap-2 text-xl font-bold">
            <Activity className="h-5 w-5" /> {vol}%
          </div>
          <div className="text-xs text-muted-foreground">
            {highVol ? "⚠️ High volatility — exercise caution" : "Within normal range"}
          </div>
        </div>
      </section>

      {/* Alerts */}
      {(highVol || risk === "High") && (
        <section className="rounded-xl border border-bear/30 bg-bear/5 p-4 text-sm">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-bear" />
            <div>
              <div className="font-semibold text-bear">High-risk alert for {symbol}</div>
              <p className="mt-1 text-muted-foreground">
                This asset currently shows {highVol && "elevated volatility"} {highVol && risk === "High" && "and "}
                {risk === "High" && "high directional risk"}. Consider position sizing, stop-losses, and consulting
                a SEBI-registered investment adviser before acting.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Principles */}
      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">Core principles</h3>
        <div className="grid gap-3 md:grid-cols-2">
          {PRINCIPLES.map((p) => (
            <div key={p.t} className="rounded-xl border border-border bg-card/40 p-4">
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="h-4 w-4 text-primary" /> {p.t}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{p.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Investor rights */}
      <section className="rounded-xl border border-border bg-card/40 p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          <BookOpen className="h-4 w-4" /> Investor rights (SEBI)
        </h3>
        <ul className="mt-3 grid gap-2 text-sm md:grid-cols-2">
          {RIGHTS.map((r) => (
            <li key={r} className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
              <span className="text-muted-foreground">{r}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted-foreground">
          Grievances can be filed via{" "}
          <a className="text-primary underline" href="https://scores.sebi.gov.in" target="_blank" rel="noreferrer">
            SEBI SCORES
          </a>
          . Always verify your broker/adviser registration on the SEBI website.
        </p>
      </section>
    </div>
  );
}
