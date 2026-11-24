// AI rationale + BUY/SELL/HOLD decision via Lovable AI Gateway
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const body = await req.json();
    const { symbol, priceSource, currentPrice, predictedPrice, ma100, ma200, rsi, recentCloses } = body;

    const sys = `You are an educational market assistant. Do not give personalized investment advice. The supplied price projection is a simple rule-based heuristic, not a trained ML model. Return a BUY/SELL/HOLD discussion tag, risk label and rationale (<=80 words). Do not invent news, sources, prices, or statistical confidence. Remind users this is informational, not advice.`;
    const user = `Symbol: ${symbol}
Price data source: ${priceSource === "Yahoo historical price data" ? "Yahoo historical price data" : "deterministic demo price series"}
Current price: ${currentPrice}
Heuristic next-day projection: ${predictedPrice}
MA100: ${ma100} | MA200: ${ma200}
RSI(14): ${rsi}
Recent 10 closes: ${(recentCloses || []).slice(-10).join(", ")}

Return JSON via the tool call.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
        tools: [{
          type: "function",
          function: {
            name: "emit_decision",
            description: "Emit the trading signal",
            parameters: {
              type: "object",
              properties: {
                decision: { type: "string", enum: ["BUY", "SELL", "HOLD"] },
                risk: { type: "string", enum: ["low", "medium", "high"] },
                rationale: { type: "string" },
              },
              required: ["decision", "risk", "rationale"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "emit_decision" } },
      }),
    });

    if (resp.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limited. Try again shortly." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (resp.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in Workspace settings." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI error", resp.status, t);
      throw new Error(`AI ${resp.status}`);
    }
    const data = await resp.json();
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    const args = call ? JSON.parse(call.function.arguments) : null;
    return new Response(JSON.stringify(args || { decision: "HOLD", risk: "medium", rationale: "Insufficient signal for a reliable explanation." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
