import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Activity, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Auth() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Redirect if already signed in
    supabase.auth.getUser().then(({ data, error }) => {
      if (!error && data.user) nav("/", { replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) nav("/", { replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [nav]);

  function validate(): string | null {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid email address";
    if (password.length < 6) return "Password must be at least 6 characters";
    if (mode === "signup" && name.trim().length > 80) return "Display name too long";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = validate();
    if (v) { toast.error(v); return; }
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: name.trim() || email.split("@")[0] },
          },
        });
        if (error) throw error;
        if (data.session) {
          toast.success("Welcome to TradeNest Pro+");
          nav("/", { replace: true });
        } else {
          toast.success("Account created. Check your email to confirm.");
          setMode("signin");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        toast.success("Signed in");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      toast.error(msg.includes("already registered") ? "Email already registered. Try signing in." : msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) toast.error("Google sign-in failed");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Google sign-in failed");
    }
  }

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="w-full max-w-md rounded-xl border border-border gradient-surface p-8 shadow-card">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg gradient-primary shadow-glow">
            <Activity className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-lg font-semibold">TradeNest <span className="text-primary">Pro</span></h1>
            <p className="text-xs text-muted-foreground">AI Decision Support for Investors</p>
          </div>
        </div>

        <h2 className="mb-1 text-xl font-semibold">{mode === "signin" ? "Sign in" : "Create your account"}</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          {mode === "signin" ? "Welcome back." : "Save watchlists, portfolio & AI predictions."}
        </p>

        <button onClick={handleGoogle} type="button"
          className="mb-4 w-full rounded-md border border-border bg-card px-4 py-2.5 text-sm font-medium hover:bg-secondary">
          Continue with Google
        </button>

        <div className="my-4 flex items-center gap-3 text-[10px] uppercase tracking-widest text-muted-foreground">
          <span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "signup" && (
            <input value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Display name" autoComplete="name"
              className="w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm" />
          )}
          <input value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="Email" type="email" required autoComplete="email"
            className="w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm" />
          <input value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="Password" type="password" required minLength={6} autoComplete={mode === "signin" ? "current-password" : "new-password"}
            className="w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm" />
          <button type="submit" disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md gradient-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <div className="mt-4 text-center text-xs text-muted-foreground">
          {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
          <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="font-medium text-primary hover:underline">
            {mode === "signin" ? "Create account" : "Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
