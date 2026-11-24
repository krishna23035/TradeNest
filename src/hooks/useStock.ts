import { useEffect, useMemo, useState } from "react";
import {
  ALL_ASSETS,
  findAsset,
  generateCandles,
  generateSentiment,
  predictNext,
  rsi as rsiFn,
  macd as macdFn,
  sma,
  decide,
  volatilityPct,
  type Candle,
} from "@/lib/market";

export type Analysis = ReturnType<typeof buildAnalysis> & { loading: boolean; isLive: boolean };

function buildAnalysis(symbol: string, candles: Candle[]) {
  const closes = candles.map((c) => c.close);
  const rsiSeries = rsiFn(closes, 14);
  const macdRes = macdFn(closes);
  const sma20 = sma(closes, 20);
  const sma50 = sma(closes, 50);
  const sma100 = sma(closes, 100);
  const sma200 = sma(closes, 200);
  const prediction = predictNext(candles);
  const sentiment = generateSentiment(symbol);
  const vol = volatilityPct(candles);
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2] ?? last;
  const changePct = +(((last.close - prev.close) / prev.close) * 100).toFixed(2);
  const decision = decide({
    predictionChangePct: prediction.change,
    rsi: rsiSeries.at(-1) ?? null,
    macdHist: macdRes.hist.at(-1) ?? null,
    smaShort: sma20.at(-1) ?? null,
    smaLong: sma50.at(-1) ?? null,
    sentiment: sentiment.score,
    volatilityPct: vol,
  });
  return { candles, rsiSeries, macdRes, sma20, sma50, sma100, sma200, prediction, sentiment, vol, last, changePct, decision };
}

// Map our symbol to a Yahoo ticker (NSE stocks need .NS suffix; crypto/US already valid)
function toYahooSymbol(symbol: string) {
  const s = findAsset(symbol);
  if (s?.exchange === "NSE") return `${symbol}.NS`;
  return symbol;
}

async function fetchYahooCandles(symbol: string): Promise<Candle[] | null> {
  try {
    const ySym = toYahooSymbol(symbol);
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stock-data?symbol=${encodeURIComponent(ySym)}&range=1y&interval=1d`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
    });
    if (!res.ok) return null;
    const json: unknown = await res.json();
    const candles = typeof json === "object" && json !== null && "candles" in json ? json.candles : null;
    if (!Array.isArray(candles)) return null;
    const parsed = candles.flatMap((item: unknown): Candle[] => {
      if (typeof item !== "object" || item === null) return [];
      const candle = item as Record<string, unknown>;
      const time = Number(candle.time);
      const open = Number(candle.open);
      const high = Number(candle.high);
      const low = Number(candle.low);
      const close = Number(candle.close);
      if (![time, open, high, low, close].every(Number.isFinite) || close <= 0) return [];
      return [{
        date: new Date(time).toISOString().slice(0, 10),
        open: +open.toFixed(2), high: +high.toFixed(2), low: +low.toFixed(2),
        close: +close.toFixed(2), volume: Number(candle.volume) || 0,
      }];
    });
    return parsed.length ? parsed : null;
  } catch {
    return null;
  }
}

export function useStock(symbol: string) {
  const [liveCandles, setLiveCandles] = useState<Candle[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchYahooCandles(symbol).then((c) => {
      if (alive) {
        setLiveCandles(c);
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
  }, [symbol]);

  // Refresh every 30s for "live" feel
  useEffect(() => {
    const id = setInterval(() => {
      fetchYahooCandles(symbol).then((c) => {
        if (c) setLiveCandles(c);
      });
    }, 30000);
    return () => clearInterval(id);
  }, [symbol]);

  return useMemo(() => {
    const candles = liveCandles ?? generateCandles(symbol, 250);
    const a = buildAnalysis(symbol, candles);
    return { ...a, loading, isLive: !!liveCandles };
  }, [symbol, liveCandles, loading]);
}

function snapshotOf(list: typeof ALL_ASSETS) {
  return list.map((s) => {
    const c = generateCandles(s.symbol, 30);
    const last = c[c.length - 1].close;
    const prev = c[c.length - 2].close;
    const changePct = +(((last - prev) / prev) * 100).toFixed(2);
    return { ...s, last, changePct };
  });
}

export function useMarketSnapshot() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 6000);
    return () => clearInterval(id);
  }, []);
  return snapshotOf(ALL_ASSETS);
}

export function useCryptoSnapshot() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 4000);
    return () => clearInterval(id);
  }, []);
  return snapshotOf(ALL_ASSETS.filter((a) => a.kind === "crypto"));
}
