// Yahoo Finance proxy: quote + historical OHLC
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const symbol = (url.searchParams.get("symbol") || "AAPL").toUpperCase();
    const range = url.searchParams.get("range") || "1y";
    const interval = url.searchParams.get("interval") || "1d";

    const yfUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=false`;
    const r = await fetch(yfUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; TradeNestPro/1.0)",
        Accept: "application/json",
      },
    });
    if (!r.ok) {
      const text = await r.text();
      console.error("Yahoo error", r.status, text);
      return new Response(JSON.stringify({ error: `Yahoo ${r.status}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = await r.json();
    const result = data?.chart?.result?.[0];
    if (!result) {
      return new Response(JSON.stringify({ error: "No data" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const meta = result.meta;
    const ts: number[] = result.timestamp || [];
    const q = result.indicators?.quote?.[0] || {};
    const candles = ts.map((t, i) => ({
      time: t * 1000,
      open: q.open?.[i],
      high: q.high?.[i],
      low: q.low?.[i],
      close: q.close?.[i],
      volume: q.volume?.[i],
    })).filter((c) => c.close != null);

    return new Response(
      JSON.stringify({
        symbol: meta.symbol,
        currency: meta.currency,
        exchange: meta.exchangeName,
        regularMarketPrice: meta.regularMarketPrice,
        previousClose: meta.chartPreviousClose ?? meta.previousClose,
        candles,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
