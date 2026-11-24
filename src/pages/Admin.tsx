import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Stock = Tables<"stocks">;
type UserRole = Tables<"user_roles">;
type Profile = Tables<"profiles">;
type Audit = Tables<"audit_logs">;
type Settings = Tables<"system_settings">;
type Template = Tables<"notification_templates">;
const field = "h-9 rounded-md border border-border bg-secondary/50 px-3 text-sm text-foreground";
const button = "h-9 rounded-md border border-border bg-secondary/60 px-3 text-sm hover:border-primary/60 disabled:opacity-50";

export default function Admin() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [admin, setAdmin] = useState(false);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [symbol, setSymbol] = useState("RELIANCE");
  const [price, setPrice] = useState(0);
  const [newSymbol, setNewSymbol] = useState("");
  const [newName, setNewName] = useState("");
  const [newExchange, setNewExchange] = useState("NSE");
  const [newSector, setNewSector] = useState("");
  const [newPrice, setNewPrice] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    const [staffResult, adminResult] = await Promise.all([supabase.rpc("is_staff"), supabase.rpc("is_admin")]);
    if (staffResult.error) { setError(staffResult.error.message); setAllowed(false); return; }
    setAllowed(Boolean(staffResult.data));
    setAdmin(Boolean(adminResult.data));
    if (!staffResult.data) return;
    const [s, r, p, a, config, templateResult] = await Promise.all([
      supabase.from("stocks").select("*").order("symbol"),
      supabase.from("user_roles").select("*").order("updated_at", { ascending: false }),
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("system_settings").select("*").eq("singleton", true).maybeSingle(),
      supabase.from("notification_templates").select("*").order("template_key"),
    ]);
    const failure = [s, r, p, a, config, templateResult].find((item) => item.error)?.error;
    if (failure) { setError(failure.message); return; }
    setError("");
    setStocks(s.data ?? []);
    setRoles(r.data ?? []);
    setProfiles(p.data ?? []);
    setAudit(a.data ?? []);
    setSettings(config.data);
    setTemplates(templateResult.data ?? []);
  }

  useEffect(() => { void refresh(); }, []);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try { await action(); await refresh(); toast.success("Admin change saved"); }
    catch (cause) { toast.error(cause instanceof Error ? cause.message : "Request failed"); }
    finally { setBusy(false); }
  }

  function updateQuote() {
    void run(async () => {
      const { error: requestError } = await supabase.rpc("set_simulated_quote", { p_symbol: symbol, p_price: price });
      if (requestError) throw requestError;
    });
  }

  function addStock() {
    void run(async () => {
      const { error: requestError } = await supabase.rpc("upsert_simulated_stock", {
        p_symbol: newSymbol, p_name: newName, p_exchange: newExchange, p_sector: newSector, p_price: newPrice,
      });
      if (requestError) throw requestError;
      setNewSymbol(""); setNewName(""); setNewSector(""); setNewPrice(0);
    });
  }

  function changeRole(userId: string, role: "trader" | "broker" | "admin") {
    void run(async () => {
      const { error: requestError } = await supabase.rpc("set_user_role", { p_user: userId, p_role: role });
      if (requestError) throw requestError;
    });
  }

  function changeKyc(userId: string, status: string) {
    void run(async () => {
      const { error: requestError } = await supabase.rpc("set_kyc_status", { p_user: userId, p_status: status });
      if (requestError) throw requestError;
    });
  }

  function saveRules() {
    void run(async () => {
      if (!settings) return;
      const { error: requestError } = await supabase.rpc("update_trading_rules", {
        p_max_quantity: settings.max_order_quantity,
        p_max_value: settings.max_order_value,
        p_max_per_minute: settings.max_orders_per_minute,
      });
      if (requestError) throw requestError;
    });
  }

  function saveTemplate(template: Template) {
    void run(async () => {
      const { error: requestError } = await supabase.rpc("set_notification_template", {
        p_key: template.template_key, p_body: template.body,
      });
      if (requestError) throw requestError;
    });
  }

  if (allowed === null) return <div className="p-8 text-sm text-muted-foreground">Checking staff access…</div>;
  if (!allowed) return <div className="rounded-xl border border-border bg-card p-5"><h2 className="font-semibold">Staff access required</h2><p className="mt-2 text-sm text-muted-foreground">An administrator must grant your account a staff role. {error}</p></div>;

  return <div className="space-y-5">
    <header><div className="text-[10px] uppercase tracking-widest text-primary">TradeNest administration</div><h2 className="mt-1 font-mono text-3xl font-bold">System controls</h2><p className="text-sm text-muted-foreground">{admin ? "Administrator" : "Broker support · read only"} · Simulated market and audit records</p></header>
    {error && <div role="alert" className="rounded-lg border border-bear/40 bg-bear/5 p-3 text-sm text-bear">{error}</div>}
    <section className="grid gap-5 lg:grid-cols-2">
      <div className="rounded-xl border border-border bg-card p-5 shadow-card"><h3 className="font-semibold">Simulated quote</h3><p className="mt-1 text-xs text-muted-foreground">Updating a quote checks pending limit orders and price alerts atomically.</p><div className="mt-3 flex flex-wrap gap-2"><select aria-label="Stock symbol" className={field} value={symbol} onChange={(e) => { setSymbol(e.target.value); setPrice(stocks.find((s) => s.symbol === e.target.value)?.last_price ?? 0); }}>{stocks.map((s) => <option key={s.symbol}>{s.symbol}</option>)}</select><input aria-label="Simulated price" className={`${field} w-32`} type="number" min="0.01" step="0.01" value={price || ""} onChange={(e) => setPrice(Number(e.target.value))} placeholder={stocks.find((s) => s.symbol === symbol)?.last_price.toFixed(2)} /><button className={button} disabled={!admin || busy} onClick={updateQuote}>Update quote</button></div></div>
      <div className="rounded-xl border border-border bg-card p-5 shadow-card"><h3 className="font-semibold">Trading rules</h3>{settings && <div className="mt-3 flex flex-wrap gap-2"><label className="text-xs text-muted-foreground">Max quantity<input aria-label="Maximum order quantity" className={`${field} mt-1 block w-28`} type="number" min={1} value={settings.max_order_quantity} onChange={(e) => setSettings({ ...settings, max_order_quantity: Number(e.target.value) })} disabled={!admin} /></label><label className="text-xs text-muted-foreground">Max value<input aria-label="Maximum order value" className={`${field} mt-1 block w-32`} type="number" min={1} value={settings.max_order_value} onChange={(e) => setSettings({ ...settings, max_order_value: Number(e.target.value) })} disabled={!admin} /></label><label className="text-xs text-muted-foreground">Orders/min<input aria-label="Maximum orders per minute" className={`${field} mt-1 block w-24`} type="number" min={1} value={settings.max_orders_per_minute} onChange={(e) => setSettings({ ...settings, max_orders_per_minute: Number(e.target.value) })} disabled={!admin} /></label><button className={`${button} self-end`} disabled={!admin || busy} onClick={saveRules}>Save rules</button></div>}</div>
    </section>
    <section className="rounded-xl border border-border bg-card p-5 shadow-card"><h3 className="font-semibold">Stock master</h3><p className="mt-1 text-xs text-muted-foreground">Add a simulated stock or edit its details. Use quote update to test alerts and orders.</p><div className="mt-3 flex flex-wrap gap-2"><input aria-label="New symbol" className={`${field} w-32`} value={newSymbol} onChange={(e) => setNewSymbol(e.target.value)} placeholder="Symbol" disabled={!admin} /><input aria-label="Company name" className={field} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Company" disabled={!admin} /><input aria-label="Exchange" className={`${field} w-24`} value={newExchange} onChange={(e) => setNewExchange(e.target.value)} disabled={!admin} /><input aria-label="Sector" className={field} value={newSector} onChange={(e) => setNewSector(e.target.value)} placeholder="Sector" disabled={!admin} /><input aria-label="Starting quote" className={`${field} w-28`} type="number" min="0.01" step="0.01" value={newPrice || ""} onChange={(e) => setNewPrice(Number(e.target.value))} placeholder="Quote" disabled={!admin} /><button className={button} disabled={!admin || busy} onClick={addStock}>Save stock</button></div></section>
    <section className="rounded-xl border border-border bg-card p-5 shadow-card"><h3 className="font-semibold">Notification templates</h3><p className="mt-1 text-xs text-muted-foreground">Placeholders such as {'{symbol}'}, {'{price}'}, {'{side}'}, and {'{quantity}'} are filled by the server.</p><div className="mt-3 space-y-2">{templates.map((template) => <div key={template.template_key} className="flex flex-wrap items-center gap-2"><span className="w-36 font-mono text-xs">{template.template_key}</span><input aria-label={`Template ${template.template_key}`} className={`${field} min-w-0 flex-1`} value={template.body} maxLength={500} disabled={!admin} onChange={(e) => setTemplates((items) => items.map((item) => item.template_key === template.template_key ? { ...item, body: e.target.value } : item))} /><button className={button} disabled={!admin || busy} onClick={() => saveTemplate(template)}>Save</button></div>)}</div></section>
    <section className="rounded-xl border border-border bg-card p-5 shadow-card"><h3 className="font-semibold">Users and roles</h3><div className="mt-3 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border text-left text-xs text-muted-foreground"><th className="py-2">User</th><th>Role</th><th>KYC status</th></tr></thead><tbody>{roles.map((role) => { const profile = profiles.find((p) => p.id === role.user_id); return <tr key={role.user_id} className="border-b border-border/60"><td className="py-2">{profile?.display_name ?? role.user_id.slice(0, 8)} <span className="font-mono text-xs text-muted-foreground">{role.user_id.slice(0, 8)}</span></td><td><select aria-label={`Role for ${role.user_id}`} className={field} disabled={!admin || busy} value={role.role_id} onChange={(e) => changeRole(role.user_id, e.target.value as "trader" | "broker" | "admin")}><option value="trader">Trader</option><option value="broker">Broker support</option><option value="admin">Admin</option></select></td><td><select aria-label={`KYC for ${role.user_id}`} className={field} disabled={!admin || busy || !profile} value={profile?.kyc_status ?? "not_required_paper"} onChange={(e) => changeKyc(role.user_id, e.target.value)}><option value="not_required_paper">Not required (paper)</option><option value="pending">Pending</option><option value="verified">Verified</option><option value="rejected">Rejected</option></select></td></tr>; })}</tbody></table></div></section>
    <section className="rounded-xl border border-border bg-card p-5 shadow-card"><h3 className="font-semibold">Audit log</h3><div className="mt-3 max-h-96 overflow-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border text-left text-xs text-muted-foreground"><th className="py-2">Time</th><th>Actor</th><th>Action</th><th>Details</th></tr></thead><tbody>{audit.map((entry) => <tr key={entry.id} className="border-b border-border/60 align-top"><td className="py-2 whitespace-nowrap">{new Date(entry.created_at).toLocaleString()}</td><td className="font-mono text-xs">{entry.user_id?.slice(0, 8) ?? "system"}</td><td>{entry.action}</td><td className="break-all font-mono text-xs text-muted-foreground">{JSON.stringify(entry.details)}</td></tr>)}</tbody></table></div></section>
  </div>;
}
