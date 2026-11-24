import { useSymbol } from "@/contexts/SymbolContext";
import { Portfolio as PortfolioWidget } from "@/components/Portfolio";
import { Briefcase } from "lucide-react";

export default function PortfolioPage() {
  const { setSymbol } = useSymbol();
  return (
    <div className="space-y-5">
      <header>
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-primary">
          <Briefcase className="h-3.5 w-3.5" /> Portfolio
        </div>
        <h2 className="mt-1 font-mono text-3xl font-bold">Your holdings</h2>
        <div className="text-sm text-muted-foreground">Track investments, P/L and performance.</div>
      </header>
      <PortfolioWidget onSelect={setSymbol} />
    </div>
  );
}
