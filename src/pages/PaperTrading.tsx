import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { estimateDailyVolatility, portfolioMetrics, portfolioRisk } from "@/lib/paperMath";
import { generateCandles } from "@/lib/market";
import { PaperAnalytics } from "@/components/PaperAnalytics";
import { loadPaperLedger, loadPaperReportSnapshot } from "@/lib/paperData";
import { buildPaperReport, reportCsv, reportPdf, type ReportFormat, type ReportKind } from "@/lib/paperReports";

type Stock = Tables<"stocks">;
type Holding = Tables<"holdings">;
type Order = Tables<"orders">;
type Transaction = Tables<"transactions">;
type Alert = Tables<"price_alerts">;
type Watch = Tables<"watchlist">;
type Wallet = Tables<"wallets">;
type Notification = Tables<"notifications">;
type Profile = Tables<"profiles">;
type AiLog = Tables<"ai_logs">;
type Report = Tables<"reports">;

const field = "h-9 rounded-md border border-border bg-secondary/50 px-3 text-sm text-foreground";
const button = "h-9 rounded-md border border-border bg-secondary/60 px-3 text-sm hover:border-primary/60 disabled:opacity-50";

export default function PaperTrading() {
  const [userId, setUserId] = useState<string | null>(null);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [watchlist, setWatchlist] = useState<Watch[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [aiLogs, setAiLogs] = useState<AiLog[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [historyOrders, setHistoryOrders] = useState<Order[]>([]);
  const [quoteHistory, setQuoteHistory] = useState<Tables<"paper_quote_history">[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [reportFrom, setReportFrom] = useState("");
  const [reportTo, setReportTo] = useState("");
  const [symbol, setSymbol] = useState("RELIANCE");
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [orderKind, setOrderKind] = useState<"MARKET" | "LIMIT">("MARKET");
  const [quantity, setQuantity] = useState(1);
  const [limitPrice, setLimitPrice] = useState(0);
  const [fundAmount, setFundAmount] = useState(1000);
  const [targetPrice, setTargetPrice] = useState(0);
  const [condition, setCondition] = useState<"ABOVE" | "BELOW">("ABOVE");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const orderRequest = useRef<{ draft: string; key: string } | null>(null);
  const walletRequest = useRef<{ draft: string; key: string } | null>(null);

  async function refresh() {
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) { setError("Please sign in to use paper trading."); setHistoryLoading(false); return; }
    const id = auth.user.id;
    setUserId(id);
    const [s, w, h, o, t, a, l, n, p, ai, r] = await Promise.all([
      supabase.from("stocks").select("*").order("symbol"),
      supabase.from("wallets").select("*").eq("user_id", id).maybeSingle(),
      supabase.from("holdings").select("*").eq("user_id", id).order("symbol"),
      supabase.from("orders").select("*").eq("user_id", id).order("created_at", { ascending: false }).limit(100),
      supabase.from("transactions").select("*").eq("user_id", id).order("created_at", { ascending: false }).limit(100),
      supabase.from("price_alerts").select("*").eq("user_id", id).order("created_at", { ascending: false }),
      supabase.from("watchlist").select("*").eq("user_id", id).order("created_at", { ascending: false }),
      supabase.from("notifications").select("*").eq("user_id", id).order("created_at", { ascending: false }).limit(20),
      supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
      supabase.from("ai_logs").select("*").eq("user_id", id).order("created_at", { ascending: false }).limit(10),
      supabase.from("reports").select("*").eq("user_id", id).order("created_at", { ascending: false }).limit(10),
    ]);
    const failure = [s, w, h, o, t, a, l, n, p, ai, r].find((result) => result.error)?.error;
    if (failure) { setError(`Paper account unavailable: ${failure.message}. Apply the TradeNest Supabase migration.`); setHistoryLoading(false); return; }
    setError("");
    setStocks(s.data ?? []);
    setWallet(w.data);
    setHoldings(h.data ?? []);
    setOrders(o.data ?? []);
    setTransactions(t.data ?? []);
    setAlerts(a.data ?? []);
    setWatchlist(l.data ?? []);
    setNotifications(n.data ?? []);
    setProfile(p.data);
    setDisplayName(p.data?.display_name ?? "");
    setAiLogs(ai.data ?? []);
    setReports(r.data ?? []);
    setHistoryLoading(true);
    try {
      const ledger = await loadPaperLedger(id);
      setHistoryOrders(ledger.orders);
      setQuoteHistory(ledger.quotes);
      setHistoryError("");
    } catch (cause) {
      setHistoryError(cause instanceof Error ? cause.message : "Recorded history unavailable");
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, []);

  const selected = stocks.find((stock) => stock.symbol === symbol);
  const positions = useMemo(() => holdings.map((holding) => {
    const stock = stocks.find((item) => item.symbol === holding.symbol);
    return { symbol: holding.symbol, sector: stock?.sector ?? "Other", quantity: holding.quantity,
      avgPrice: holding.avg_price, costBasis: holding.cost_basis,
      lastPrice: stock?.last_price ?? holding.avg_price, realizedPl: holding.realized_pl,
      dailyVolatility: estimateDailyVolatility(generateCandles(holding.symbol, 30).map((candle) => candle.close)) };
  }), [holdings, stocks]);
  const metrics = portfolioMetrics(positions);
  const recentTrades = orders.filter((order) => new Date(order.created_at).getTime() > Date.now() - 30 * 86400000).length;
  const risk = portfolioRisk(positions, recentTrades);
  const watchSymbols = new Set(watchlist.map((row) => row.symbol));

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try { await action(); await refresh(); }
    catch (cause) { toast.error(cause instanceof Error ? cause.message : "Request failed"); }
    finally { setBusy(false); }
  }

  function requireUser() {
    if (!userId) throw new Error("Please sign in first");
    return userId;
  }

  function placeOrder() {
    void run(async () => {
      if (!selected || !Number.isInteger(quantity) || quantity < 1) throw new Error("Choose a stock and positive whole quantity");
      if (orderKind === "LIMIT" && (!Number.isFinite(limitPrice) || limitPrice <= 0))
        throw new Error("Enter a positive limit price");
      const draft = `${symbol}|${side}|${quantity}|${orderKind}|${orderKind === "LIMIT" ? limitPrice : ""}`;
      if (orderRequest.current?.draft !== draft) orderRequest.current = { draft, key: crypto.randomUUID() };
      const key = orderRequest.current.key;
      const { error: requestError } = orderKind === "LIMIT"
        ? await supabase.rpc("place_paper_limit_order", { p_symbol: symbol, p_side: side, p_quantity: quantity, p_limit_price: limitPrice, p_idempotency_key: key })
        : await supabase.rpc("place_paper_order", { p_symbol: symbol, p_side: side, p_quantity: quantity, p_idempotency_key: key });
      if (requestError) throw requestError;
      orderRequest.current = null;
      toast.success(orderKind === "LIMIT" ? "Limit paper order queued" : `${side} paper order executed; see order history for the execution price`);
    });
  }

  function changeFunds(direction: "VIRTUAL_DEPOSIT" | "VIRTUAL_WITHDRAWAL") {
    void run(async () => {
      if (!Number.isFinite(fundAmount) || fundAmount <= 0 || Math.abs(Math.round(fundAmount * 100) - fundAmount * 100) > 1e-8)
        throw new Error("Enter a positive amount with at most two decimals");
      const draft = `${direction}|${fundAmount}`;
      if (walletRequest.current?.draft !== draft) walletRequest.current = { draft, key: crypto.randomUUID() };
      const { error: requestError } = await supabase.rpc("adjust_paper_wallet", { p_amount: fundAmount, p_direction: direction, p_idempotency_key: walletRequest.current.key });
      if (requestError) throw requestError;
      walletRequest.current = null;
      toast.success(`${direction === "VIRTUAL_DEPOSIT" ? "Added" : "Removed"} virtual credits`);
    });
  }

  function toggleWatch(stock: Stock) {
    void run(async () => {
      const id = requireUser();
      const existing = watchlist.find((row) => row.symbol === stock.symbol);
      const result = existing
        ? await supabase.from("watchlist").delete().eq("id", existing.id).eq("user_id", id)
        : await supabase.from("watchlist").insert({ user_id: id, symbol: stock.symbol, name: stock.company_name });
      if (result.error) throw result.error;
    });
  }

  function createAlert() {
    void run(async () => {
      const id = requireUser();
      if (!selected || !Number.isFinite(targetPrice) || targetPrice <= 0) throw new Error("Enter a positive target price");
      const { error: requestError } = await supabase.from("price_alerts").insert({
        user_id: id, symbol, target_price: targetPrice, condition_type: condition,
      });
      if (requestError) throw requestError;
      toast.success("Simulated price alert created");
    });
  }

  function cancelAlert(alert: Alert) {
    void run(async () => {
      const { error: requestError } = await supabase.from("price_alerts")
        .update({ status: "CANCELLED" }).eq("id", alert.id).eq("user_id", requireUser());
      if (requestError) throw requestError;
    });
  }

  function saveProfile() {
    void run(async () => {
      const id = requireUser();
      if (displayName.trim().length < 2 || displayName.trim().length > 80) throw new Error("Display name must be 2–80 characters");
      const { error: requestError } = await supabase.from("profiles").update({ display_name: displayName.trim() }).eq("id", id);
      if (requestError) throw requestError;
      toast.success("Profile updated");
    });
  }

  function saveRiskInsight() {
    void run(async () => {
      const id = requireUser();
      const summary = `${risk.label} paper portfolio risk (${risk.score}/100). ${risk.reasons.join(" ")} ` +
        `Holdings value ${metrics.value.toFixed(2)} credits; unrealized P/L ${metrics.unrealizedPl.toFixed(2)} credits. ` +
        "Rule-based educational analysis; no investment advice.";
      const { error: requestError } = await supabase.from("ai_logs").insert({
        user_id: id, request_type: "RISK", input_summary: `${positions.length} positions, ${recentTrades} recent trades`, ai_response: summary,
      });
      if (requestError) throw requestError;
      toast.success("Risk insight saved");
    });
  }

  function savePortfolioSummary() {
    void run(async () => {
      const id = requireUser();
      const top = [...positions].filter((p) => p.quantity > 0)
        .sort((a, b) => b.quantity * b.lastPrice - a.quantity * a.lastPrice).slice(0, 3)
        .map((p) => `${p.symbol} (${(p.quantity * p.lastPrice).toFixed(2)} credits)`).join(", ") || "none";
      const summary = `Paper portfolio: ${metrics.value.toFixed(2)} virtual credits in holdings and ` +
        `${(wallet?.available_balance ?? 0).toFixed(2)} available. Unrealized P/L ${metrics.unrealizedPl.toFixed(2)}; ` +
        `realized P/L ${metrics.realizedPl.toFixed(2)}. Largest positions: ${top}. ` +
        `Risk is ${risk.label.toLowerCase()} (${risk.score}/100). Review concentration and position sizing before making decisions. ` +
        "Rule-based educational summary, not investment advice.";
      const { error: requestError } = await supabase.from("ai_logs").insert({
        user_id: id, request_type: "SUMMARY", input_summary: `${positions.length} positions, ${recentTrades} recent trades`, ai_response: summary,
      });
      if (requestError) throw requestError;
      toast.success("Portfolio summary saved");
    });
  }

  function exportReport(kind: ReportKind, format: ReportFormat) {
    void run(async () => {
      const id = requireUser();
      const { data: auth } = await supabase.auth.getUser();
      if (auth.user?.id !== id) throw new Error("Session changed; sign in again before exporting");
      const snapshot = await loadPaperReportSnapshot(id);
      const report = buildPaperReport(kind, snapshot, { from: reportFrom || undefined, to: reportTo || undefined });
      const name = `TradeNest_${kind.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.${format}`;
      const content = format === "csv" ? reportCsv(report) : await reportPdf(report);
      const { error: requestError } = await supabase.from("reports").insert({ user_id: id, report_type: kind, file_name: name });
      if (requestError) throw requestError;
      const blob = new Blob([content], { type: format === "csv" ? "text/csv;charset=utf-8" : "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = name; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      toast.success(`${format.toUpperCase()} report downloaded`);
    });
  }

  return <div className="space-y-5">
    <header>
      <div className="text-[10px] uppercase tracking-widest text-primary">TradeNest paper account</div>
      <h2 className="mt-1 font-mono text-3xl font-bold">Paper trading</h2>
      <p className="text-sm text-muted-foreground">Simulated quotes and virtual credits only. No broker, payment, or real-money execution.</p>
    </header>
    {error && <div role="alert" className="rounded-lg border border-bear/40 bg-bear/5 p-3 text-sm text-bear">{error}</div>}
    <section className="grid gap-4 md:grid-cols-5">
      <Metric label="Virtual cash" value={(wallet?.available_balance ?? 0).toFixed(2)} />
      <Metric label="Reserved credits" value={(wallet?.blocked_balance ?? 0).toFixed(2)} />
      <Metric label="Holdings value" value={metrics.value.toFixed(2)} />
      <Metric label="Unrealized P/L" value={metrics.unrealizedPl.toFixed(2)} />
      <Metric label="Risk score" value={`${risk.score}/100 · ${risk.label}`} />
    </section>
    <section className="grid gap-5 lg:grid-cols-2">
      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <h3 className="font-semibold">Account profile</h3>
        <p className="mt-1 text-xs text-muted-foreground">KYC status: {profile?.kyc_status.replace(/_/g, " ") ?? "unavailable"}. Paper trading does not require identity verification.</p>
        <div className="mt-3 flex gap-2"><input aria-label="Display name" className={`${field} min-w-0 flex-1`} value={displayName} maxLength={80} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display name" /><button className={button} disabled={busy || !profile} onClick={saveProfile}>Save</button></div>
      </div>
      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <h3 className="font-semibold">Portfolio risk insight</h3>
        <p className="mt-1 text-xs text-muted-foreground">Rule-based analysis of concentration, sector exposure, demo-series volatility and recent trading frequency.</p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted-foreground">{risk.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
        <div className="mt-3 flex flex-wrap gap-2"><button className={button} disabled={busy || !wallet} onClick={saveRiskInsight}>Save risk insight</button><button className={button} disabled={busy || !wallet} onClick={savePortfolioSummary}>Save portfolio summary</button></div>
        {metrics.value > 0 && <p className="mt-2 text-xs text-muted-foreground">Sector exposure: {Object.entries(metrics.sectorTotals).map(([sector, value]) => `${sector} ${(value / metrics.value * 100).toFixed(1)}%`).join(" · ")}</p>}
        {aiLogs[0] && <p className="mt-2 text-xs text-muted-foreground">Last saved {aiLogs[0].request_type.toLowerCase()}: {aiLogs[0].ai_response}</p>}
      </div>
    </section>
    <section className="grid gap-5 lg:grid-cols-2">
      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <h3 className="font-semibold">Place a paper order</h3>
        <p className="mt-1 text-xs text-muted-foreground">Instant orders use the server's simulated quote. Limit orders queue until an admin quote reaches the target.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <select aria-label="Paper stock" className={field} value={symbol} onChange={(e) => setSymbol(e.target.value)}>
            {stocks.map((stock) => <option key={stock.symbol} value={stock.symbol}>{stock.symbol} · {stock.company_name}</option>)}
          </select>
          <select aria-label="Order side" className={field} value={side} onChange={(e) => setSide(e.target.value as "BUY" | "SELL")}>
            <option>BUY</option><option>SELL</option>
          </select>
          <select aria-label="Order kind" className={field} value={orderKind} onChange={(e) => setOrderKind(e.target.value as "MARKET" | "LIMIT")}><option value="MARKET">Instant</option><option value="LIMIT">Limit</option></select>
          <input aria-label="Quantity" className={`${field} w-24`} type="number" min={1} step={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
          {orderKind === "LIMIT" && <input aria-label="Limit price" className={`${field} w-28`} type="number" min="0.01" step="0.01" value={limitPrice || ""} onChange={(e) => setLimitPrice(Number(e.target.value))} placeholder="Limit price" />}
          <button className={button} disabled={busy || !selected} onClick={placeOrder}>{orderKind === "LIMIT" ? "Queue limit order" : "Execute paper order"}</button>
        </div>
        <p className="mt-3 font-mono text-xs text-muted-foreground">Simulated price: {selected?.last_price.toFixed(2) ?? "—"} · Estimated total: {selected ? (selected.last_price * quantity).toFixed(2) : "—"} virtual credits</p>
      </div>
      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <h3 className="font-semibold">Virtual wallet</h3>
        <p className="mt-1 text-xs text-muted-foreground">Practice deposits and withdrawals change virtual credits only.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <input aria-label="Virtual amount" className={`${field} w-36`} type="number" min="0.01" step="0.01" value={fundAmount} onChange={(e) => setFundAmount(Number(e.target.value))} />
          <button className={button} disabled={busy || !wallet} onClick={() => changeFunds("VIRTUAL_DEPOSIT")}>Add credits</button>
          <button className={button} disabled={busy || !wallet} onClick={() => changeFunds("VIRTUAL_WITHDRAWAL")}>Withdraw credits</button>
        </div>
      </div>
    </section>
    <section className="rounded-xl border border-border bg-card p-5 shadow-card">
      <h3 className="font-semibold">Simulated market and watchlist</h3>
      <p className="mt-1 text-xs text-muted-foreground">Watching: {watchlist.map((item) => item.symbol).join(", ") || "no stocks yet"}</p>
      <div className="mt-3 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border text-left text-xs text-muted-foreground"><th className="py-2">Symbol</th><th>Company</th><th>Exchange</th><th className="text-right">Simulated quote</th><th className="text-right">Watch</th></tr></thead><tbody>
        {stocks.map((stock) => <tr key={stock.symbol} className="border-b border-border/60"><td className="py-2 font-mono">{stock.symbol}</td><td>{stock.company_name}</td><td>{stock.exchange}</td><td className="text-right font-mono">{stock.last_price.toFixed(2)}</td><td className="text-right"><button className="text-primary hover:underline" disabled={busy} onClick={() => toggleWatch(stock)}>{watchSymbols.has(stock.symbol) ? "Remove" : "Add"}</button></td></tr>)}
      </tbody></table></div>
    </section>
    <section className="grid gap-5 lg:grid-cols-2">
      <div className="rounded-xl border border-border bg-card p-5 shadow-card"><h3 className="font-semibold">Account notifications</h3><div className="mt-3 space-y-2 text-sm">{notifications.map((notification) => <div key={notification.id} className="border-b border-border/60 pb-2"><div className="font-medium">{notification.title}</div><div className="text-xs text-muted-foreground">{notification.message} · {new Date(notification.created_at).toLocaleString()}</div></div>)}{notifications.length === 0 && <p className="text-muted-foreground">No notifications yet.</p>}</div></div>
      <div className="rounded-xl border border-border bg-card p-5 shadow-card"><h3 className="font-semibold">Report history</h3><div className="mt-3 space-y-2 text-sm">{reports.map((report) => <div key={report.id} className="border-b border-border/60 pb-2">{report.report_type} · {report.file_name}<div className="text-xs text-muted-foreground">{new Date(report.created_at).toLocaleString()}</div></div>)}{reports.length === 0 && <p className="text-muted-foreground">No reports exported yet.</p>}</div></div>
    </section>
    <section className="grid gap-5 lg:grid-cols-2">
      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <h3 className="font-semibold">Paper holdings</h3>
        <div className="mt-3 space-y-2 text-sm">{holdings.filter((h) => h.quantity > 0).map((h) => {
          const price = stocks.find((s) => s.symbol === h.symbol)?.last_price ?? h.avg_price;
          return <div key={h.symbol} className="flex justify-between border-b border-border/60 pb-2"><span>{h.symbol} · {h.quantity} × {h.avg_price.toFixed(2)}</span><span className="font-mono">{(h.quantity * price).toFixed(2)} · P/L {(h.quantity * price - h.cost_basis).toFixed(2)}</span></div>;
        })}{!holdings.some((h) => h.quantity > 0) && <p className="text-muted-foreground">No paper holdings yet.</p>}</div>
        <p className="mt-3 text-xs text-muted-foreground">Realized P/L: {metrics.realizedPl.toFixed(2)} · Largest holding: {metrics.largestPositionPct.toFixed(1)}%</p>
      </div>
      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <h3 className="font-semibold">Price alerts</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <select aria-label="Alert direction" className={field} value={condition} onChange={(e) => setCondition(e.target.value as "ABOVE" | "BELOW")}><option>ABOVE</option><option>BELOW</option></select>
          <input aria-label="Target price" className={`${field} w-32`} type="number" min="0.01" step="0.01" value={targetPrice || ""} onChange={(e) => setTargetPrice(Number(e.target.value))} placeholder="Target price" />
          <button className={button} disabled={busy || !selected} onClick={createAlert}>Alert for {symbol}</button>
        </div>
        {selected && <p className="mt-2 text-xs text-muted-foreground">Suggested practice levels: {(selected.last_price * 1.05).toFixed(2)} above or {(selected.last_price * 0.95).toFixed(2)} below the simulated quote.</p>}
        <div className="mt-3 space-y-2 text-sm">{alerts.map((alert) => <div key={alert.id} className="flex justify-between border-b border-border/60 pb-2"><span>{alert.symbol} {alert.condition_type.toLowerCase()} {alert.target_price.toFixed(2)} · {alert.status.toLowerCase()}</span>{alert.status === "ACTIVE" && <button className="text-bear hover:underline" disabled={busy} onClick={() => cancelAlert(alert)}>Cancel</button>}</div>)}{alerts.length === 0 && <p className="text-muted-foreground">No price alerts.</p>}</div>
        <p className="mt-3 text-xs text-muted-foreground">Alerts trigger when an administrator updates a simulated quote.</p>
      </div>
    </section>
    <PaperAnalytics holdings={holdings} stocks={stocks} orders={historyOrders} quotes={quoteHistory} loading={historyLoading} error={historyError} />
    <section className="rounded-xl border border-border bg-card p-5 shadow-card">
      <h3 className="font-semibold">Orders and reports</h3>
      <div className="mt-3 flex flex-wrap items-end gap-2 text-xs"><label>From (UTC)<input aria-label="Report from date" className={`${field} ml-2`} type="date" value={reportFrom} onChange={(event) => setReportFrom(event.target.value)} /></label><label>To (UTC)<input aria-label="Report to date" className={`${field} ml-2`} type="date" value={reportTo} onChange={(event) => setReportTo(event.target.value)} /></label><span className="text-muted-foreground">Dates filter trades, wallet activity and P/L history; current holdings remain a snapshot.</span></div>
      <div className="mt-3 flex flex-wrap gap-2">{(["PORTFOLIO", "TRADE", "STATEMENT", "PROFIT_LOSS"] as ReportKind[]).map((kind) => <div key={kind} className="flex gap-1"><button className={button} disabled={busy} onClick={() => exportReport(kind, "csv")}>{kind.replace("_", " ")} CSV</button><button className={button} disabled={busy} onClick={() => exportReport(kind, "pdf")}>PDF</button></div>)}</div>
      <div className="mt-3 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border text-left text-xs text-muted-foreground"><th className="py-2">Time</th><th>Symbol</th><th>Side</th><th className="text-right">Qty</th><th className="text-right">Limit</th><th className="text-right">Executed</th><th className="text-right">Status</th><th /></tr></thead><tbody>{orders.map((order) => <tr key={order.id} className="border-b border-border/60"><td className="py-2">{new Date(order.created_at).toLocaleString()}</td><td>{order.symbol}</td><td>{order.side}</td><td className="text-right">{order.quantity}</td><td className="text-right font-mono">{order.limit_price?.toFixed(2) ?? "—"}</td><td className="text-right font-mono">{order.executed_price?.toFixed(2) ?? "—"}</td><td className="text-right">{order.status}</td><td className="text-right">{order.status === "PENDING" && <button className="text-bear hover:underline" disabled={busy} onClick={() => void run(async () => { const { error: requestError } = await supabase.rpc("cancel_paper_order", { p_order: order.id }); if (requestError) throw requestError; })}>Cancel</button>}</td></tr>)}</tbody></table>{orders.length === 0 && <p className="mt-3 text-sm text-muted-foreground">No paper orders yet.</p>}</div>
    </section>
    <section className="rounded-xl border border-border bg-card p-5 shadow-card"><h3 className="font-semibold">Virtual transaction ledger</h3><div className="mt-3 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border text-left text-xs text-muted-foreground"><th className="py-2">Time</th><th>Type</th><th className="text-right">Amount</th><th className="text-right">Balance after</th></tr></thead><tbody>{transactions.map((txn) => <tr key={txn.id} className="border-b border-border/60"><td className="py-2">{new Date(txn.created_at).toLocaleString()}</td><td>{txn.txn_type.replace(/_/g, " ")}</td><td className="text-right font-mono">{txn.amount.toFixed(2)}</td><td className="text-right font-mono">{txn.balance_after.toFixed(2)}</td></tr>)}</tbody></table>{transactions.length === 0 && <p className="mt-3 text-sm text-muted-foreground">No virtual transactions yet.</p>}</div></section>
  </div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-border bg-card p-4 shadow-card"><div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div><div className="mt-2 font-mono text-xl font-semibold">{value}</div></div>;
}
