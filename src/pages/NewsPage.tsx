import { useSymbol } from "@/contexts/SymbolContext";
import { useNews } from "@/hooks/useNews";
import { NewsPanel } from "@/components/NewsPanel";
import { SentimentPanel } from "@/components/SentimentPanel";
import { Newspaper } from "lucide-react";

export default function NewsPage() {
  const { symbol } = useSymbol();
  const { news, loading, error } = useNews(symbol);
  return (
    <div className="space-y-5">
      <header>
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-primary">
          <Newspaper className="h-3.5 w-3.5" /> News & Sentiment
        </div>
        <h2 className="mt-1 font-mono text-3xl font-bold">{symbol}</h2>
        <div className="text-sm text-muted-foreground">Fetched financial headlines with a clearly labeled word-based sentiment score.</div>
      </header>
      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 xl:col-span-7">
          <NewsPanel news={news} loading={loading} error={error} />
        </div>
        <div className="col-span-12 xl:col-span-5">
          <SentimentPanel news={news} loading={loading} />
        </div>
      </div>
    </div>
  );
}
