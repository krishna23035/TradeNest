import { useEffect, useMemo, useState } from "react";
import { Sparkles, PieChart as PieIcon, AlertTriangle, TrendingUp, Wallet } from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";
import { ALL_ASSETS, generateCandles, volatilityPct, findAsset } from "@/lib/market";

type Holding = { symbol: string; qty: number; avg: number };
const KEY = "tradenest.portfolio";
const COLORS = [
  "hsl(var(--primary))", "hsl(var(--bull))", "hsl(var(--warn))",
  "hsl(var(--bear))", "hsl(var(--accent))", "#8b5cf6", "#06b6d4", "#f59e0b",
];

function loadHoldings(): Holding[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
function saveHoldings(h: Holding[]) { localStorage.setItem(KEY, JSON.stringify(h)); }

export default function Optimizer() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [sym, setSym] = useState("RELIANCE");
  const [amount, setAmount] = useState(10000);

  useEffect(() => {
    const h = loadHoldings();
    setHoldings(h.length ? h : [
      { symbol: "RELIANCE", qty: 12, avg: 2750 },
      { symbol: "TCS", qty: 5, avg: 3980 },
      { symbol: "AAPL", qty: 8, avg: 210 },
      { symbol: "BTC-USD", qty: 0.05, avg: 64000 },
    ]);
  }, []);
  useEffect(() => { if (holdings.length) saveHoldings(holdings); }, [holdings]);

  const enriched = useMemo(() => holdings.map((h) => {
    const asset = findAsset(h.symbol);
    const c = generateCandles(h.symbol, 60);
    const last = c[c.length - 1].close;
    const value = last * h.qty;
    const cost = h.avg * h.qty;
    const pl = value - cost;
    const vol = volatilityPct(c);
    return { ...h, name: asset?.name ?? h.symbol, sector: asset?.sector ?? "Other", kind: asset?.kind ?? "stock", last, value, cost, pl, vol };
  }), [holdings]);

  const totalCost = enriched.reduce((a, h) => a + h.cost, 0);
  const totalValue = enriched.reduce((a, h) => a + h.value, 0);
  const totalPL = totalValue - totalCost;
  const totalPLPct = totalCost ? (totalPL / totalCost) * 100 : 0;

  // Sector distribution
  const sectorMap = new Map<string, number>();
  enriched.forEach((h) => sectorMap.set(h.sector, (sectorMap.get(h.sector) || 0) + h.value));
  const sectorData = Array.from(sectorMap.entries()).map(([name, value]) => ({ name, value: +value.toFixed(2) }));

  // Allocation
  const allocData = enriched.map((h) => ({ name: h.symbol, value: +h.value.toFixed(2) }));

  // Portfolio risk: weighted avg volatility
  const wVol = totalValue
    ? enriched.reduce((a, h) => a + (h.vol * h.value) / totalValue, 0)
    : 0;
  const riskLevel: "Low" | "Medium" | "High" = wVol > 3.5 ? "High" : wVol > 1.8 ? "Medium" : "Low";
  const riskClass = riskLevel === "High" ? "text-bear" : riskLevel === "Medium" ? "text-warn" : "text-bull";

  // Diversification: top concentration
  const topShare = totalValue
    ? Math.max(...enriched.map((h) => h.value)) / totalValue
    : 0;
  const sectorShare = totalValue
    ? Math.max(...sectorData.map((s) => s.value)) / totalValue
    : 0;

  // AI-style suggestions (rule-based, deterministic)
  const suggestions: { tone: "good" | "warn" | "bad"; text: string }[] = [];
  if (enriched.length < 4) suggestions.push({ tone: "warn", text: "Portfolio has fewer than 4 holdings — diversification is limited." });
  if (topShare > 0.4) suggestions.push({ tone: "bad", text: `One holding represents ${(topShare * 100).toFixed(0)}% of value. Consider trimming exposure.` });
  if (sectorShare > 0.5) {
    const dom = sectorData.sort((a, b) => b.value - a.value)[0];
    suggestions.push({ tone: "bad", text: `${dom.name} sector is ${(sectorShare * 100).toFixed(0)}% of portfolio. Add other sectors to reduce risk.` });
  }
  if (riskLevel === "High") suggestions.push({ tone: "bad", text: "Weighted volatility is high. Add lower-volatility holdings (e.g. large-cap stocks)." });
  const cryptoShare = totalValue ? enriched.filter((h) => h.kind === "crypto").reduce((a, h) => a + h.value, 0) / totalValue : 0;
  if (cryptoShare > 0.3) suggestions.push({ tone: "warn", text: `Crypto exposure is ${(cryptoShare * 100).toFixed(0)}%. High volatility asset class — keep within risk tolerance.` });
  enriched.forEach((h) => {
    const w = totalValue ? h.value / totalValue : 0;
    if (w > 0.35) suggestions.push({ tone: "warn", text: `Reduce exposure to ${h.symbol} (${(w * 100).toFixed(0)}% of portfolio).` });
  });
  if (suggestions.length === 0) suggestions.push({ tone: "good", text: "Portfolio looks well-balanced across holdings and sectors." });

  function addHolding() {
    if (!sym || amount <= 0) return;
    const c = generateCandles(sym, 5);
    const price = c[c.length - 1].close;
    const qty = +(amount / price).toFixed(6);
    setHoldings((prev) => {
      const i = prev.findIndex((x) => x.symbol === sym);
      if (i >= 0) {
        const totalQty = prev[i].qty + qty;
        const totalCost2 = prev[i].avg * prev[i].qty + price * qty;
        const next = [...prev];
        next[i] = { symbol: sym, qty: totalQty, avg: +(totalCost2 / totalQty).toFixed(2) };
        return next;
      }
      return [...prev, { symbol: sym, qty, avg: price }];
    });
    setAmount(10000);
  }

  return (
    <div className="space-y-5">
      <header>
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-primary">
          <Sparkles className="h-3.5 w-3.5" /> Smart Portfolio Optimizer
        </div>
        <h2 className="mt-1 font-mono text-3xl font-bold">Optimize allocation & risk</h2>
        <div className="text-sm text-muted-foreground">
          Rule-based analysis of diversification, sector mix, and volatility using deterministic demo prices.
        </div>
      </header>

      {/* Summary tiles */}
      <section className="grid gap-3 md:grid-cols-4">
        <Tile label="Total invested" value={`$${totalCost.toFixed(2)}`} icon={<Wallet className="h-4 w-4" />} />
        <Tile label="Current value" value={`$${totalValue.toFixed(2)}`} icon={<TrendingUp className="h-4 w-4" />} />
        <Tile
          label="Profit / Loss"
          value={`${totalPL >= 0 ? "+" : ""}$${totalPL.toFixed(2)}`}
          sub={`${totalPLPct >= 0 ? "+" : ""}${totalPLPct.toFixed(2)}%`}
          tone={totalPL >= 0 ? "bull" : "bear"}
        />
        <Tile
          label="Risk level"
          value={riskLevel}
          sub={`${wVol.toFixed(2)}% vol`}
          tone={riskLevel === "High" ? "bear" : riskLevel === "Medium" ? "warn" : "bull"}
        />
      </section>

      {/* Add holding */}
      <section className="rounded-xl border border-border bg-card/40 p-4">
        <div className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Add stock or crypto</div>
        <div className="grid grid-cols-12 gap-2">
          <select value={sym} onChange={(e) => setSym(e.target.value)}
            className="col-span-5 h-9 rounded-md border border-border bg-secondary/50 px-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary">
            {ALL_ASSETS.map((s) => <option key={s.symbol} value={s.symbol}>{s.symbol} — {s.name}</option>)}
          </select>
          <input type="number" min={0} value={amount} onChange={(e) => setAmount(+e.target.value)} placeholder="Amount $"
            className="col-span-5 h-9 rounded-md border border-border bg-secondary/50 px-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary" />
          <button onClick={addHolding}
            className="col-span-2 rounded-md gradient-primary text-sm font-semibold text-primary-foreground hover:opacity-90">
            Invest
          </button>
        </div>
      </section>

      {/* Charts */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card/40 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <PieIcon className="h-3.5 w-3.5" /> Allocation by holding
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={allocData} dataKey="value" nameKey="name" outerRadius={100} label={(e) => e.name}>
                  {allocData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: unknown) => `$${Number(v).toFixed(2)}`}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card/40 p-4">
          <div className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Sector distribution</div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sectorData}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 6" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: unknown) => `$${Number(v).toFixed(2)}`}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {sectorData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Holdings + AI suggestions */}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card/40 lg:col-span-2 overflow-hidden">
          <div className="border-b border-border px-4 py-3 text-xs uppercase tracking-widest text-muted-foreground">Holdings breakdown</div>
          <table className="w-full text-sm">
            <thead className="bg-secondary/30 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Symbol</th>
                <th className="px-3 py-2 text-right">Weight</th>
                <th className="px-3 py-2 text-right">Invested</th>
                <th className="px-3 py-2 text-right">Value</th>
                <th className="px-3 py-2 text-right">P/L</th>
                <th className="px-3 py-2 text-right">Vol</th>
              </tr>
            </thead>
            <tbody>
              {enriched.map((h) => {
                const w = totalValue ? (h.value / totalValue) * 100 : 0;
                const plPct = h.cost ? (h.pl / h.cost) * 100 : 0;
                return (
                  <tr key={h.symbol} className="border-t border-border">
                    <td className="px-3 py-2 font-mono">{h.symbol} <span className="text-[10px] text-muted-foreground">{h.sector}</span></td>
                    <td className="px-3 py-2 text-right font-mono">{w.toFixed(1)}%</td>
                    <td className="px-3 py-2 text-right font-mono">${h.cost.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right font-mono">${h.value.toFixed(2)}</td>
                    <td className={`px-3 py-2 text-right font-mono ${h.pl >= 0 ? "text-bull" : "text-bear"}`}>
                      {h.pl >= 0 ? "+" : ""}${h.pl.toFixed(2)}
                      <div className="text-[10px] opacity-70">{plPct.toFixed(2)}%</div>
                    </td>
                    <td className={`px-3 py-2 text-right font-mono ${h.vol > 3.5 ? "text-bear" : h.vol > 1.8 ? "text-warn" : "text-bull"}`}>
                      {h.vol.toFixed(2)}%
                    </td>
                  </tr>
                );
              })}
              {!enriched.length && (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-xs text-muted-foreground">No holdings yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="rounded-xl border border-border bg-card/40 p-4">
          <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" /> AI suggestions
          </div>
          <ul className="space-y-2 text-sm">
            {suggestions.map((s, i) => (
              <li key={i} className={`flex items-start gap-2 rounded-md border p-2 ${
                s.tone === "bad" ? "border-bear/30 bg-bear/5" :
                s.tone === "warn" ? "border-warn/30 bg-warn/5" :
                "border-bull/30 bg-bull/5"
              }`}>
                <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${
                  s.tone === "bad" ? "text-bear" : s.tone === "warn" ? "text-warn" : "text-bull"
                }`} />
                <span className="text-muted-foreground">{s.text}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[10px] text-muted-foreground">
            ⚠️ Heuristic suggestions only. Not investment advice.
          </p>
        </div>
      </section>
    </div>
  );
}

function Tile({ label, value, sub, tone, icon }: { label: string; value: string; sub?: string; tone?: "bull" | "bear" | "warn"; icon?: React.ReactNode }) {
  const toneCls =
    tone === "bull" ? "text-bull" :
    tone === "bear" ? "text-bear" :
    tone === "warn" ? "text-warn" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card/40 p-4">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
        {icon} {label}
      </div>
      <div className={`mt-1 font-mono text-xl font-bold ${toneCls}`}>{value}</div>
      {sub && <div className={`text-xs ${toneCls} opacity-80`}>{sub}</div>}
    </div>
  );
}
