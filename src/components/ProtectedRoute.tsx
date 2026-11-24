import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function ProtectedRoute() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    const verify = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (active) setSignedIn(!error && Boolean(data.user));
    };
    void verify();
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) setSignedIn(false);
      else void verify();
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);

  if (signedIn === null) return <div className="p-8 text-sm text-muted-foreground">Checking account…</div>;
  return signedIn ? <Outlet /> : <Navigate to="/auth" replace />;
}
