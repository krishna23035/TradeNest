import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Bot, Send, Sparkles, User2, Loader2 } from "lucide-react";
import { useSymbol } from "@/contexts/SymbolContext";
import { useStock } from "@/hooks/useStock";
import { toast } from "sonner";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Should I buy Reliance?",
  "Is Bitcoin safe right now?",
  "Best stocks today?",
  "Explain RSI in simple terms",
];

export default function Chat() {
  const { symbol } = useSymbol();
  const a = useStock(symbol);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "👋 Hi! I'm your TradeNest AI assistant. Ask me about any stock or crypto, indicators, or market context. Try one of the suggestions below.\n\n⚠️ This is educational information, not financial advice.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    if (trimmed.length > 1000) {
      toast.error("Message too long (max 1000 chars)");
      return;
    }
    const next: Msg[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const ctx = {
        activeSymbol: symbol,
        priceSource: a.isLive ? "Yahoo historical price data" : "deterministic demo price series",
        currentPrice: a.last?.close,
        rsi: a.rsiSeries.at(-1),
        macdHist: a.macdRes.hist.at(-1),
        ma100: a.sma100.at(-1),
        ma200: a.sma200.at(-1),
        prediction: a.prediction,
        sentiment: a.sentiment,
        decision: a.decision,
        volatilityPct: a.vol,
      };
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
          context: ctx,
        }),
      });
      if (!res.ok) {
        const problem: unknown = await res.json().catch(() => ({}));
        const message = typeof problem === "object" && problem !== null && "error" in problem && typeof problem.error === "string"
          ? problem.error : `HTTP ${res.status}`;
        throw new Error(message);
      }
      const response: unknown = await res.json();
      const reply = typeof response === "object" && response !== null && "reply" in response && typeof response.reply === "string"
        ? response.reply : null;
      if (!reply) throw new Error("AI response was empty or invalid");
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Chat failed");
      setMessages((m) => [...m, { role: "assistant", content: "Sorry, I couldn't process that. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <header>
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-primary">
          <Sparkles className="h-3.5 w-3.5" /> AI Chat Assistant
        </div>
        <h2 className="mt-1 font-mono text-3xl font-bold">Ask anything about the markets</h2>
        <div className="text-sm text-muted-foreground">
          Context-aware: knows your active symbol ({symbol}) and live indicators.
        </div>
      </header>

      <div className="rounded-xl border border-border bg-card/40 shadow-card">
        <div ref={scrollRef} className="h-[520px] overflow-y-auto px-5 py-4 space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
              {m.role === "assistant" && (
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full gradient-primary">
                  <Bot className="h-4 w-4 text-primary-foreground" />
                </div>
              )}
              <div
                className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary/50 text-foreground"
                }`}
              >
                <div className="prose prose-sm prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_li]:my-0.5">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              </div>
              {m.role === "user" && (
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-secondary">
                  <User2 className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full gradient-primary">
                <Bot className="h-4 w-4 text-primary-foreground" />
              </div>
              <div className="rounded-2xl bg-secondary/50 px-4 py-2.5">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-border px-5 py-3">
          <div className="mb-3 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                disabled={loading}
                className="rounded-full border border-border bg-secondary/30 px-3 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/60 disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Ask about ${symbol} or any market topic…`}
              maxLength={1000}
              className="flex-1 rounded-md border border-border bg-secondary/40 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="inline-flex items-center gap-1.5 rounded-md gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              <Send className="h-4 w-4" /> Send
            </button>
          </form>
          <p className="mt-2 text-[10px] text-muted-foreground">
            ⚠️ Educational use only. Not investment advice. Markets carry risk.
          </p>
        </div>
      </div>
    </div>
  );
}
