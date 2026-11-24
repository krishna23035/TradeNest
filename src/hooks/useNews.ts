import { useEffect, useState } from "react";
import type { NewsItem } from "@/lib/newsSentiment";

function validNews(value: unknown): value is NewsItem {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return typeof row.uuid === "string" && typeof row.title === "string" &&
    typeof row.publisher === "string" && typeof row.link === "string" &&
    /^https:\/\//i.test(row.link) && typeof row.providerPublishTime === "number";
}

export function useNews(symbol: string) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stock-news?q=${encodeURIComponent(symbol)}`;
    fetch(url, { headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` } })
      .then(async (response) => {
        if (!response.ok) throw new Error(`News service returned ${response.status}`);
        const body: unknown = await response.json();
        const rows = typeof body === "object" && body !== null && "news" in body ? body.news : null;
        return Array.isArray(rows) ? rows.filter(validNews).map((item: NewsItem) => ({
          ...item,
          thumbnail: typeof item.thumbnail === "string" && /^https:\/\//i.test(item.thumbnail) ? item.thumbnail : undefined,
        })) : [];
      })
      .then((rows) => { if (alive) setNews(rows); })
      .catch((cause: unknown) => { if (alive) { setNews([]); setError(cause instanceof Error ? cause.message : "News unavailable"); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [symbol]);

  return { news, loading, error };
}
