import { Newspaper, ExternalLink } from "lucide-react";
import type { NewsItem } from "@/lib/newsSentiment";

export function NewsPanel({ news, loading, error }: { news: NewsItem[]; loading: boolean; error: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
        <Newspaper className="h-3.5 w-3.5" /> Fetched financial news
      </div>
      {loading && <div className="text-xs text-muted-foreground">Loading…</div>}
      {error && <div role="alert" className="text-xs text-bear">{error}</div>}
      {!loading && news.length === 0 && (
        <div className="text-xs text-muted-foreground">No news available.</div>
      )}
      <ul className="space-y-3 max-h-[420px] overflow-auto pr-1">
        {news.map((n) => (
          <li key={n.uuid} className="group">
            <a href={n.link} target="_blank" rel="noopener noreferrer"
              className="flex gap-3 rounded-md border border-border/50 bg-secondary/30 p-3 hover:border-primary/40">
              {n.thumbnail && (
                <img src={n.thumbnail} alt="" className="h-14 w-14 shrink-0 rounded object-cover" />
              )}
              <div className="min-w-0">
                <div className="line-clamp-2 text-sm font-medium group-hover:text-primary">{n.title}</div>
                <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span>{n.publisher}</span>
                  <span>·</span>
                  <span>{new Date((n.providerPublishTime || 0) * 1000).toLocaleString()}</span>
                  <ExternalLink className="ml-auto h-3 w-3 opacity-60" />
                </div>
              </div>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
