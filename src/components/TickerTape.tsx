import { useMarketSnapshot } from "@/hooks/useStock";
import { ArrowDown, ArrowUp } from "lucide-react";

export function TickerTape() {
  const data = useMarketSnapshot();
  const items = [...data, ...data];
  return (
    <div className="ticker-mask overflow-hidden border-y border-border bg-card/50">
      <div className="ticker-scroll flex gap-8 whitespace-nowrap py-2.5">
        {items.map((s, i) => {
          const up = s.changePct >= 0;
          return (
            <div key={i} className="flex items-center gap-2 px-2 text-sm">
              <span className="font-mono font-semibold text-foreground">{s.symbol}</span>
              <span className="font-mono tabular text-muted-foreground">{s.last.toFixed(2)}</span>
              <span className={`font-mono tabular flex items-center gap-0.5 ${up ? "text-bull" : "text-bear"}`}>
                {up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                {Math.abs(s.changePct).toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
