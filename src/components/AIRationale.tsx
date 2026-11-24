import { useEffect, useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Analysis } from "@/hooks/useStock";
import { toast } from "sonner";

type AIDecision = {
  decision: "BUY" | "SELL" | "HOLD";
  risk: "low" | "medium" | "high";
  rationale: string;
};

function isAIDecision(value: unknown): value is AIDecision {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return (item.decision === "BUY" || item.decision === "SELL" || item.decision === "HOLD") &&
    (item.risk === "low" || item.risk === "medium" || item.risk === "high") &&
    typeof item.rationale === "string";
}

export function AIRationale({ analysis, symbol }: { analysis: Analysis; symbol: string }) {
  const [data, setData] = useState<AIDecision | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("ai-decision", {
        body: {
          symbol,
          priceSource: analysis.isLive ? "Yahoo historical price data" : "deterministic demo price series",
          currentPrice: analysis.last.close,
          predictedPrice: analysis.prediction.next,
          ma100: analysis.sma100.at(-1),
          ma200: analysis.sma200.at(-1),
          rsi: analysis.rsiSeries.at(-1),
          recentCloses: analysis.candles.slice(-30).map((c) => c.close),
        },
      });
      if (error) throw error;
      if (typeof res === "object" && res !== null && "error" in res) {
        toast.error(String(res.error));
        return;
      }
      if (!isAIDecision(res)) throw new Error("Invalid AI response");
      setData(res);
      // log to predictions history if signed in
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("predictions").insert({
          user_id: user.id,
          symbol,
          predicted_price: analysis.prediction.next,
          current_price: analysis.last.close,
          decision: res.decision,
          confidence: null,
          rationale: res.rationale,
        });
        const { error: logError } = await supabase.from("ai_logs").insert({
          user_id: user.id,
          request_type: "SIGNAL",
          input_summary: `${symbol}: heuristic projection ${analysis.prediction.next.toFixed(2)} from ${analysis.candles.length} ${analysis.isLive ? "Yahoo historical" : "demo"} price observations`,
          ai_response: `${res.decision} / ${res.risk}: ${res.rationale}`,
        });
        if (logError) toast.error(`AI response displayed, but request log failed: ${logError.message}`);
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "AI request failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { setData(null); }, [symbol]);

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" /> AI Rationale
        </div>
        <button onClick={run} disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-md gradient-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60">
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          {loading ? "Thinking…" : "Generate"}
        </button>
      </div>
      {!data && !loading && (
        <div className="text-xs text-muted-foreground">
          Click Generate to get an AI rationale for {symbol} based on technical indicators and a heuristic price projection.
        </div>
      )}
      {data && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="rounded-md bg-primary/15 px-2 py-1 font-mono text-sm font-bold text-primary">{data.decision}</span>
            <span className="text-xs text-muted-foreground">{data.risk} risk · no calibrated prediction probability</span>
          </div>
          <p className="text-sm leading-relaxed text-foreground/90">{data.rationale}</p>
          <p className="text-[10px] text-muted-foreground">
            Informational only — not investment advice. Aligns with SEBI investor-protection guidance.
          </p>
        </div>
      )}
    </div>
  );
}
