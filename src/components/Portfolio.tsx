import { useEffect, useState } from "react";
import { Briefcase, Plus, Trash2 } from "lucide-react";
import { STOCKS, generateCandles } from "@/lib/market";

type Holding = { symbol: string; qty: number; avg: number };
const KEY = "tradenest.portfolio";

function load(): Holding[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
function save(h: Holding[]) { localStorage.setItem(KEY, JSON.stringify(h)); }

export function Portfolio({ onSelect }: { onSelect: (s: string) => void }) {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [sym, setSym] = useState("RELIANCE");
  const [qty, setQty] = useState(10);
  const [avg, setAvg] = useState(0);

  useEffect(() => {
    const h = load();
    setHoldings(h.length ? h : [
      { symbol: "RELIANCE", qty: 12, avg: 2750 },
      { symbol: "TCS", qty: 5, avg: 3980 },
      { symbol: "AAPL", qty: 8, avg: 210 },
    ]);
  }, []);

  useEffect(() => { if (holdings.length) save(holdings); }, [holdings]);

  const enriched = holdings.map((h) => {
    const c = generateCandles(h.symbol, 30);
    const last = c[c.length - 1].close;
    const value = last * h.qty;
    const cost = h.avg * h.qty;
    const pl = value - cost;
    const plPct = (pl / cost) * 100;
    return { ...h, last, value, pl, plPct };
  });
  const totalValue = enriched.reduce((a, h) => a + h.value, 0);
  const totalPL = enriched.reduce((a, h) => a + h.pl, 0);
  const totalPLPct = totalValue ? (totalPL / (totalValue - totalPL)) * 100 : 0;

  function add() {
    if (!sym || qty <= 0) return;
    const stock = STOCKS.find((s) => s.symbol === sym);
    const fallback = avg > 0 ? avg : stock?.base ?? 100;
    setHoldings((h) => {
      const i = h.findIndex((x) => x.symbol === sym);
      if (i >= 0) {
        const totalQty = h[i].qty + qty;
        const totalCost = h[i].avg * h[i].qty + fallback * qty;
        const next = [...h];
        next[i] = { symbol: sym, qty: totalQty, avg: +(totalCost / totalQty).toFixed(2) };
        return next;
      }
      return [...h, { symbol: sym, qty, avg: fallback }];
    });
    setQty(10); setAvg(0);
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
          <Briefcase className="h-3.5 w-3.5" /> Portfolio
        </div>
        <div className="text-right">
          <div className="font-mono text-lg font-semibold">${totalValue.toFixed(2)}</div>
          <div className={`font-mono text-xs ${totalPL >= 0 ? "text-bull" : "text-bear"}`}>
            {totalPL >= 0 ? "+" : ""}{totalPL.toFixed(2)} ({totalPLPct.toFixed(2)}%)
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Symbol</th>
              <th className="px-3 py-2 text-right">Qty</th>
              <th className="px-3 py-2 text-right">Avg</th>
              <th className="px-3 py-2 text-right">Last</th>
              <th className="px-3 py-2 text-right">P/L</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {enriched.map((h) => (
              <tr key={h.symbol} className="border-t border-border hover:bg-secondary/30">
                <td className="px-3 py-2">
                  <button onClick={() => onSelect(h.symbol)} className="font-mono font-semibold hover:text-primary">{h.symbol}</button>
                </td>
                <td className="px-3 py-2 text-right font-mono tabular">{h.qty}</td>
                <td className="px-3 py-2 text-right font-mono tabular">{h.avg.toFixed(2)}</td>
                <td className="px-3 py-2 text-right font-mono tabular">{h.last.toFixed(2)}</td>
                <td className={`px-3 py-2 text-right font-mono tabular ${h.pl >= 0 ? "text-bull" : "text-bear"}`}>
                  {h.pl >= 0 ? "+" : ""}{h.pl.toFixed(2)}
                  <div className="text-[10px] opacity-70">{h.plPct.toFixed(2)}%</div>
                </td>
                <td className="px-2">
                  <button
                    onClick={() => setHoldings((x) => x.filter((y) => y.symbol !== h.symbol))}
                    className="text-muted-foreground hover:text-bear"
                    aria-label="Remove"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {enriched.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-xs text-muted-foreground">No holdings yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 grid grid-cols-12 gap-2">
        <select value={sym} onChange={(e) => setSym(e.target.value)}
          className="col-span-4 h-9 rounded-md border border-border bg-secondary/50 px-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30">
          {STOCKS.map((s) => <option key={s.symbol} value={s.symbol}>{s.symbol}</option>)}
        </select>
        <input type="number" min={1} value={qty} onChange={(e) => setQty(+e.target.value)} placeholder="Qty"
          className="col-span-3 h-9 rounded-md border border-border bg-secondary/50 px-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30" />
        <input type="number" min={0} value={avg || ""} onChange={(e) => setAvg(+e.target.value)} placeholder="Avg price"
          className="col-span-3 h-9 rounded-md border border-border bg-secondary/50 px-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30" />
        <button onClick={add}
          className="col-span-2 inline-flex items-center justify-center gap-1 rounded-md gradient-primary text-primary-foreground text-sm font-semibold transition hover:opacity-90">
          <Plus className="h-4 w-4" /> Add
        </button>
      </div>
    </div>
  );
}
