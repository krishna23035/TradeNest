import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Activity, BarChart3, Bitcoin, Brain, Briefcase,
  LogOut, Newspaper, GitCompare, LayoutDashboard, MessageSquare, Sparkles, Scale, Wallet, Shield,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { StockSearch } from "@/components/StockSearch";
import { TickerTape } from "@/components/TickerTape";
import { SymbolProvider, useSymbol } from "@/contexts/SymbolContext";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/crypto", label: "Crypto", icon: Bitcoin },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/ai-insights", label: "AI Insights", icon: Brain },
  { to: "/chat", label: "AI Chat", icon: MessageSquare },
  { to: "/models", label: "Model Comparison", icon: GitCompare },
  { to: "/portfolio", label: "Portfolio", icon: Briefcase },
  { to: "/paper", label: "Paper Trading", icon: Wallet },
  { to: "/admin", label: "Admin", icon: Shield },
  { to: "/optimizer", label: "Optimizer", icon: Sparkles },
  { to: "/news", label: "News", icon: Newspaper },
  { to: "/compliance", label: "Compliance", icon: Scale },
];

function Header() {
  const nav = useNavigate();
  const { symbol, setSymbol } = useSymbol();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) { toast.error(error.message); return; }
    nav("/auth", { replace: true });
  }

  return (
    <header className="sticky top-0 z-20 glass">
      <div className="mx-auto flex max-w-[1500px] items-center gap-6 px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg gradient-primary shadow-glow">
            <Activity className="h-4 w-4 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-base font-semibold leading-none">
              TradeNest <span className="text-primary">Pro+</span>
            </h1>
            <div className="mt-0.5 flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
              <span className="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-bull" />
              Yahoo historical data · demo fallback
            </div>
          </div>
        </div>

        <div className="flex-1 flex justify-center">
          <StockSearch value={symbol} onChange={setSymbol} />
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {email && <span className="hidden lg:inline truncate max-w-[160px]" title={email}>{email}</span>}
          <button onClick={signOut} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 hover:text-foreground" aria-label="Sign out">
            <LogOut className="h-3 w-3" /> Sign out
          </button>
        </div>
      </div>
      <TickerTape />
    </header>
  );
}

function Sidebar() {
  return (
    <aside className="sticky top-[100px] hidden h-[calc(100vh-120px)] w-56 shrink-0 flex-col gap-1 border-r border-border pr-3 md:flex">
      <div className="px-2 py-2 text-[10px] uppercase tracking-widest text-muted-foreground">Modules</div>
      {NAV.map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          end={n.end}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${
              isActive
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
            }`
          }
        >
          <n.icon className="h-4 w-4" />
          {n.label}
        </NavLink>
      ))}
      <div className="mt-auto rounded-lg border border-border bg-card/40 p-3 text-[11px] text-muted-foreground">
        <div className="font-semibold text-foreground">SEBI notice</div>
        Educational decision support — not investment advice.
      </div>
    </aside>
  );
}

function MobileNav() {
  return (
    <nav className="md:hidden mx-auto max-w-[1500px] overflow-x-auto px-6 py-3">
      <div className="flex gap-2">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              `inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-3 py-1.5 text-xs transition ${
                isActive
                  ? "border-primary/60 bg-primary/15 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`
            }
          >
            <n.icon className="h-3.5 w-3.5" />
            {n.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

export default function AppShell() {
  return (
    <SymbolProvider>
      <div className="min-h-screen">
        <Header />
        <MobileNav />
        <div className="mx-auto flex max-w-[1500px] gap-6 px-6 pb-10 pt-6">
          <Sidebar />
          <main className="min-w-0 flex-1">
            <Outlet />
          </main>
        </div>
      </div>
    </SymbolProvider>
  );
}
