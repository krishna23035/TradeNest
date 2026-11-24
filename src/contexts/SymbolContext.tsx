import { createContext, useContext, useState, ReactNode } from "react";

type Ctx = {
  symbol: string;
  setSymbol: (s: string) => void;
};
const SymbolCtx = createContext<Ctx | null>(null);

export function SymbolProvider({ children }: { children: ReactNode }) {
  const [symbol, setSymbol] = useState("RELIANCE");
  return <SymbolCtx.Provider value={{ symbol, setSymbol }}>{children}</SymbolCtx.Provider>;
}

export function useSymbol() {
  const c = useContext(SymbolCtx);
  if (!c) throw new Error("useSymbol must be used within SymbolProvider");
  return c;
}
