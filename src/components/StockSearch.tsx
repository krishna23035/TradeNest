import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { ALL_ASSETS } from "@/lib/market";

interface Props {
  value: string;
  onChange: (s: string) => void;
}

export function StockSearch({ value, onChange }: Props) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return ALL_ASSETS.slice(0, 6);
    return ALL_ASSETS.filter(
      (s) => s.symbol.toLowerCase().includes(term) || s.name.toLowerCase().includes(term)
    ).slice(0, 8);
  }, [q]);

  return (
    <div className="relative w-full max-w-md">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Search stocks  •  current: ${value}`}
          className="h-11 w-full rounded-lg border border-border bg-secondary/60 pl-10 pr-4 text-sm font-mono placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>
      {open && (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-elev fade-up">
          {matches.map((s) => (
            <button
              key={s.symbol}
              onMouseDown={() => {
                onChange(s.symbol);
                setQ("");
                setOpen(false);
              }}
              className="flex w-full items-center justify-between border-b border-border/60 px-4 py-2.5 text-left text-sm last:border-b-0 hover:bg-secondary"
            >
              <div>
                <div className="font-mono font-semibold">{s.symbol}</div>
                <div className="text-xs text-muted-foreground">{s.name}</div>
              </div>
              <span className="rounded-md border border-border bg-secondary/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {s.exchange}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
