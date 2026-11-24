// Mock realistic stock data + indicators + decision engine.
// Designed so every value is deterministic per symbol for a stable demo.

export type Candle = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type AssetKind = "stock" | "crypto";
export type Stock = {
  symbol: string;
  name: string;
  exchange: "NSE" | "NASDAQ" | "NYSE" | "CRYPTO";
  sector: string;
  base: number;
  kind?: AssetKind;
};

export const STOCKS: Stock[] = [
  { symbol: "RELIANCE", name: "Reliance Industries", exchange: "NSE", sector: "Energy", base: 2890 },
  { symbol: "TCS", name: "Tata Consultancy Services", exchange: "NSE", sector: "IT", base: 4120 },
  { symbol: "INFY", name: "Infosys", exchange: "NSE", sector: "IT", base: 1640 },
  { symbol: "HDFCBANK", name: "HDFC Bank", exchange: "NSE", sector: "Banking", base: 1685 },
  { symbol: "ICICIBANK", name: "ICICI Bank", exchange: "NSE", sector: "Banking", base: 1248 },
  { symbol: "ADANIENT", name: "Adani Enterprises", exchange: "NSE", sector: "Conglomerate", base: 2410 },
  { symbol: "TATAMOTORS", name: "Tata Motors", exchange: "NSE", sector: "Auto", base: 985 },
  { symbol: "AAPL", name: "Apple Inc.", exchange: "NASDAQ", sector: "Tech", base: 224 },
  { symbol: "MSFT", name: "Microsoft", exchange: "NASDAQ", sector: "Tech", base: 432 },
  { symbol: "NVDA", name: "NVIDIA", exchange: "NASDAQ", sector: "Semiconductors", base: 138 },
  { symbol: "TSLA", name: "Tesla", exchange: "NASDAQ", sector: "Auto", base: 248 },
  { symbol: "GOOGL", name: "Alphabet", exchange: "NASDAQ", sector: "Tech", base: 178 },
];

export const CRYPTOS: Stock[] = [
  { symbol: "BTC-USD", name: "Bitcoin", exchange: "CRYPTO", sector: "Crypto", base: 68000, kind: "crypto" },
  { symbol: "ETH-USD", name: "Ethereum", exchange: "CRYPTO", sector: "Crypto", base: 3500, kind: "crypto" },
  { symbol: "SOL-USD", name: "Solana", exchange: "CRYPTO", sector: "Crypto", base: 165, kind: "crypto" },
  { symbol: "BNB-USD", name: "BNB", exchange: "CRYPTO", sector: "Crypto", base: 580, kind: "crypto" },
  { symbol: "XRP-USD", name: "XRP", exchange: "CRYPTO", sector: "Crypto", base: 0.55, kind: "crypto" },
  { symbol: "ADA-USD", name: "Cardano", exchange: "CRYPTO", sector: "Crypto", base: 0.45, kind: "crypto" },
  { symbol: "DOGE-USD", name: "Dogecoin", exchange: "CRYPTO", sector: "Crypto", base: 0.13, kind: "crypto" },
  { symbol: "AVAX-USD", name: "Avalanche", exchange: "CRYPTO", sector: "Crypto", base: 36, kind: "crypto" },
];

export const ALL_ASSETS: Stock[] = [...STOCKS, ...CRYPTOS];

export function findAsset(symbol: string): Stock | undefined {
  return ALL_ASSETS.find((s) => s.symbol === symbol);
}

// Seeded PRNG for deterministic per-symbol series
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashCode(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function generateCandles(symbol: string, days = 120): Candle[] {
  const stock = ALL_ASSETS.find((s) => s.symbol === symbol);
  const base = stock?.base ?? 100;
  const rand = mulberry32(hashCode(symbol));
  const out: Candle[] = [];
  let price = base * 0.9;
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const drift = (rand() - 0.48) * base * 0.018;
    const vol = base * (0.012 + rand() * 0.018);
    const open = price;
    const close = Math.max(1, open + drift);
    const high = Math.max(open, close) + rand() * vol;
    const low = Math.min(open, close) - rand() * vol;
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    out.push({
      date: d.toISOString().slice(0, 10),
      open: +open.toFixed(2),
      high: +high.toFixed(2),
      low: +low.toFixed(2),
      close: +close.toFixed(2),
      volume: Math.round(500_000 + rand() * 4_500_000),
    });
    price = close;
  }
  return out;
}

// ---------- Indicators ----------
export function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    out.push(i >= period - 1 ? +(sum / period).toFixed(2) : null);
  }
  return out;
}

export function ema(values: number[], period: number): (number | null)[] {
  const k = 2 / (period + 1);
  const out: (number | null)[] = [];
  let prev: number | null = null;
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      out.push(null);
      continue;
    }
    if (prev === null) {
      const seed = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
      prev = seed;
      out.push(+seed.toFixed(2));
      continue;
    }
    prev = values[i] * k + prev * (1 - k);
    out.push(+prev.toFixed(2));
  }
  return out;
}

export function rsi(values: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = [null];
  let gains = 0;
  let losses = 0;
  for (let i = 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    const gain = Math.max(0, diff);
    const loss = Math.max(0, -diff);
    if (i <= period) {
      gains += gain;
      losses += loss;
      if (i === period) {
        const rs = gains / period / (losses / period || 1e-9);
        out.push(+(100 - 100 / (1 + rs)).toFixed(2));
      } else {
        out.push(null);
      }
    } else {
      gains = (gains * (period - 1) + gain) / period;
      losses = (losses * (period - 1) + loss) / period;
      const rs = gains / (losses || 1e-9);
      out.push(+(100 - 100 / (1 + rs)).toFixed(2));
    }
  }
  return out;
}

export function macd(values: number[]) {
  const e12 = ema(values, 12);
  const e26 = ema(values, 26);
  const line = values.map((_, i) =>
    e12[i] !== null && e26[i] !== null ? +((e12[i]! - e26[i]!).toFixed(3)) : null
  );
  const lineNumeric = line.map((v) => v ?? 0);
  const sig = ema(lineNumeric, 9).map((v, i) => (line[i] === null ? null : v));
  const hist = line.map((v, i) => (v !== null && sig[i] !== null ? +(v - sig[i]!).toFixed(3) : null));
  return { line, signal: sig, hist };
}

// ---------- "LSTM-style" prediction (simulated) ----------
// Combines short trend, momentum, and a tiny noise term — produces stable next-day price.
export function predictNext(candles: Candle[]) {
  const closes = candles.map((c) => c.close);
  const n = closes.length;
  const last = closes[n - 1];
  const ma5 = closes.slice(-5).reduce((a, b) => a + b, 0) / 5;
  const ma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const momentum = (last - closes[n - 10]) / closes[n - 10];
  const trend = (ma5 - ma20) / ma20;
  const drift = trend * 0.6 + momentum * 0.25;
  const next = +(last * (1 + drift * 0.4)).toFixed(2);
  const change = +((next - last) / last * 100).toFixed(2);
  return { next, change, last };
}

// ---------- Sentiment is unavailable until verified news has been fetched ----------
export type Headline = { title: string; source: string; score: number; time: string };
export function generateSentiment(_symbol: string): { score: number; label: "Unavailable"; headlines: Headline[] } {
  return { score: 0, label: "Unavailable", headlines: [] };
}

// ---------- Decision engine ----------
export type Decision = {
  action: "BUY" | "SELL" | "HOLD";
  signalScore: number;
  risk: "Low" | "Medium" | "High";
  reasons: string[];
};

export function decide(params: {
  predictionChangePct: number;
  rsi: number | null;
  macdHist: number | null;
  smaShort: number | null;
  smaLong: number | null;
  sentiment: number;
  volatilityPct: number;
}): Decision {
  let score = 0;
  const reasons: string[] = [];

  if (params.predictionChangePct > 1.2) { score += 2; reasons.push(`Heuristic projection +${params.predictionChangePct}% next session`); }
  else if (params.predictionChangePct < -1.2) { score -= 2; reasons.push(`Heuristic projection ${params.predictionChangePct}% next session`); }

  if (params.rsi !== null) {
    if (params.rsi < 30) { score += 1.5; reasons.push(`RSI ${params.rsi} — oversold`); }
    else if (params.rsi > 70) { score -= 1.5; reasons.push(`RSI ${params.rsi} — overbought`); }
  }

  if (params.macdHist !== null) {
    if (params.macdHist > 0) { score += 1; reasons.push("MACD histogram positive — bullish momentum"); }
    else { score -= 1; reasons.push("MACD histogram negative — bearish momentum"); }
  }

  if (params.smaShort && params.smaLong) {
    if (params.smaShort > params.smaLong) { score += 1; reasons.push("Short MA above long MA — uptrend"); }
    else { score -= 1; reasons.push("Short MA below long MA — downtrend"); }
  }

  if (params.sentiment > 0.2) { score += 1; reasons.push(`News sentiment positive (${params.sentiment})`); }
  else if (params.sentiment < -0.2) { score -= 1; reasons.push(`News sentiment negative (${params.sentiment})`); }

  const action: Decision["action"] = score >= 2 ? "BUY" : score <= -2 ? "SELL" : "HOLD";
  const signalScore = Math.min(100, Math.round(Math.abs(score) / 6.5 * 100));
  const risk: Decision["risk"] =
    params.volatilityPct > 3.5 ? "High" : params.volatilityPct > 1.8 ? "Medium" : "Low";

  return { action, signalScore, risk, reasons };
}

export function volatilityPct(candles: Candle[], period = 20) {
  const slice = candles.slice(-period);
  const returns = slice.slice(1).map((c, i) => Math.log(c.close / slice[i].close));
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length;
  return +(Math.sqrt(variance) * 100).toFixed(2);
}

// ---------- Heikin Ashi ----------
export function heikinAshi(candles: Candle[]): Candle[] {
  const out: Candle[] = [];
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const haClose = (c.open + c.high + c.low + c.close) / 4;
    const prev = out[i - 1];
    const haOpen = prev ? (prev.open + prev.close) / 2 : (c.open + c.close) / 2;
    const haHigh = Math.max(c.high, haOpen, haClose);
    const haLow = Math.min(c.low, haOpen, haClose);
    out.push({
      date: c.date,
      open: +haOpen.toFixed(2),
      high: +haHigh.toFixed(2),
      low: +haLow.toFixed(2),
      close: +haClose.toFixed(2),
      volume: c.volume,
    });
  }
  return out;
}

// ---------- Heuristic comparison, not trained ML models ----------
// Walk-forward calculations on the supplied closes. Demo data remains demo data.
export type ModelResult = {
  name: string;
  predictions: { date: string; actual: number; predicted: number }[];
  mae: number;
  rmse: number;
  accuracy: number; // directional %
  nextPrediction: number;
};

function metrics(actuals: number[], preds: number[]) {
  const n = actuals.length;
  const errs = actuals.map((a, i) => a - preds[i]);
  const mae = +(errs.reduce((s, e) => s + Math.abs(e), 0) / n).toFixed(3);
  const rmse = +Math.sqrt(errs.reduce((s, e) => s + e * e, 0) / n).toFixed(3);
  let correct = 0;
  for (let i = 1; i < n; i++) {
    const dirA = Math.sign(actuals[i] - actuals[i - 1]);
    const dirP = Math.sign(preds[i] - actuals[i - 1]);
    if (dirA === dirP) correct++;
  }
  const accuracy = +((correct / Math.max(1, n - 1)) * 100).toFixed(1);
  return { mae, rmse, accuracy };
}

function linearRegressionPredict(window: number[]): number {
  const n = window.length;
  const xs = Array.from({ length: n }, (_, i) => i);
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = window.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (window[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = meanY - slope * meanX;
  return slope * n + intercept;
}

function lstmLikePredict(window: number[]): number {
  // weighted moving avg + momentum (proxy for LSTM output)
  const n = window.length;
  const recent = window.slice(-5);
  const ma5 = recent.reduce((a, b) => a + b, 0) / recent.length;
  const ma20 = window.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const last = window[n - 1];
  const momentum = (last - window[n - 10]) / window[n - 10];
  const trend = (ma5 - ma20) / ma20;
  return last * (1 + (trend * 0.6 + momentum * 0.25) * 0.4);
}

function randomForestLikePredict(window: number[]): number {
  // ensemble: median of (lr, lstm, ma, momentum)
  const ma = window.slice(-10).reduce((a, b) => a + b, 0) / 10;
  const last = window[window.length - 1];
  const lr = linearRegressionPredict(window.slice(-30));
  const lstm = lstmLikePredict(window);
  const arr = [ma, lr, lstm, last].sort((a, b) => a - b);
  return (arr[1] + arr[2]) / 2;
}

function arimaLikePredict(window: number[]): number {
  // AR(1) with drift
  const n = window.length;
  const diffs = window.slice(1).map((v, i) => v - window[i]);
  const meanDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  return window[n - 1] + meanDiff * 0.7;
}

const MODELS: { name: string; fn: (w: number[]) => number }[] = [
  { name: "LSTM proxy", fn: lstmLikePredict },
  { name: "Linear trend", fn: linearRegressionPredict },
  { name: "Median ensemble", fn: randomForestLikePredict },
  { name: "AR drift", fn: arimaLikePredict },
];

export function compareModels(candles: Candle[], lookback = 60): ModelResult[] {
  const closes = candles.map((c) => c.close);
  const dates = candles.map((c) => c.date);
  const start = Math.max(60, closes.length - lookback);
  return MODELS.map(({ name, fn }) => {
    const preds: number[] = [];
    const actuals: number[] = [];
    const series: { date: string; actual: number; predicted: number }[] = [];
    for (let i = start; i < closes.length; i++) {
      const window = closes.slice(0, i);
      const p = fn(window);
      preds.push(p);
      actuals.push(closes[i]);
      series.push({ date: dates[i], actual: +closes[i].toFixed(2), predicted: +p.toFixed(2) });
    }
    const m = metrics(actuals, preds);
    const nextPrediction = +fn(closes).toFixed(2);
    return { name, predictions: series, ...m, nextPrediction };
  });
}
