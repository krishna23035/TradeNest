// Yahoo Finance news search
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get("q") || url.searchParams.get("symbol") || "stock market";
    const yfUrl = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&newsCount=15&quotesCount=0`;
    const r = await fetch(yfUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TradeNestPro/1.0)" },
    });
    if (!r.ok) {
      return new Response(JSON.stringify({ news: [], error: `Yahoo news service returned ${r.status}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data: unknown = await r.json();
    const rawNews = typeof data === "object" && data !== null && "news" in data && Array.isArray(data.news) ? data.news : [];
    const news = rawNews.map((item: unknown) => {
      const n = typeof item === "object" && item !== null ? item as Record<string, unknown> : {};
      const thumbnail = typeof n.thumbnail === "object" && n.thumbnail !== null ? n.thumbnail as { resolutions?: { url?: string }[] } : null;
      return {
      uuid: n.uuid,
      title: n.title,
      publisher: n.publisher,
      link: n.link,
      providerPublishTime: n.providerPublishTime,
      thumbnail: thumbnail?.resolutions?.[0]?.url,
      };
    });
    return new Response(JSON.stringify({ news }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ news: [], error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
