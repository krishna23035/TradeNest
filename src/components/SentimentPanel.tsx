import { Newspaper } from "lucide-react";
import { headlineScore, newsSentiment, type NewsItem } from "@/lib/newsSentiment";

export function SentimentPanel({ news, loading }: { news: NewsItem[]; loading: boolean }) {
  const sentiment = newsSentiment(news);
  return <div className="rounded-xl border border-border bg-card p-5 shadow-card">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground"><Newspaper className="h-3.5 w-3.5" /> Headline sentiment</div>
      <span className="font-mono text-sm font-semibold">{loading ? "Loading…" : sentiment.label}{sentiment.score !== null && !loading ? ` · ${sentiment.score.toFixed(2)}` : ""}</span>
    </div>
    <p className="mt-2 text-xs text-muted-foreground">Simple word-based score on fetched Yahoo headlines. It is not a trained NLP model or a trading confidence estimate.</p>
    {!loading && news.length === 0 && <p className="mt-3 text-xs text-muted-foreground">No verified headlines available; sentiment cannot be assessed.</p>}
    {!loading && news.length > 0 && <>
      <p className="mt-3 text-xs text-muted-foreground">{sentiment.scored} of {news.length} headlines contain scored terms.</p>
      <ul className="mt-3 space-y-3">{news.slice(0, 6).map((item) => <li key={item.uuid} className="border-b border-border/60 pb-2 text-xs">
        <div className="font-medium">{item.title}</div><div className="mt-1 text-muted-foreground">{item.publisher} · heuristic title score {headlineScore(item.title).toFixed(2)}</div>
      </li>)}</ul>
    </>}
  </div>;
}
