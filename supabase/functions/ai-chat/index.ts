// AI Chat Assistant — streams a market-aware response via Lovable AI Gateway
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const { messages, context } = await req.json();
    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages array required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const sys = `You are TradeNest's market assistant. You help retail investors understand stocks, crypto, technical indicators (RSI, MACD, MAs), and news sentiment.

Rules:
- You DO NOT give personalized investment advice. You explain context.
- Always end with: "⚠️ This is educational information, not financial advice."
- When asked "should I buy X", give an educational BUY/SELL/HOLD discussion tag and 3-5 short reasons. Never state a statistical confidence or invent news; say when news or market data is unavailable. Heuristic projections are not trained ML forecasts.
- Use markdown bullets. Keep replies under 180 words.
- If user asks something unrelated to finance/markets, politely redirect.

${context ? `\nCurrent market context:\n${JSON.stringify(context).slice(0, 2000)}` : ""}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: sys }, ...messages],
      }),
    });

    if (resp.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limited. Please slow down." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (resp.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI error", resp.status, t);
      throw new Error(`AI ${resp.status}`);
    }
    const data = await resp.json();
    const reply = data.choices?.[0]?.message?.content ?? "I couldn't generate a response.";
    return new Response(JSON.stringify({ reply }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
