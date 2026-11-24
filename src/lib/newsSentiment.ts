export type NewsItem = {
  uuid: string;
  title: string;
  publisher: string;
  link: string;
  providerPublishTime: number;
  thumbnail?: string;
};

const positive = new Set(["beats", "beat", "growth", "gains", "gain", "rises", "rise", "upgrades", "upgrade", "profit", "profits", "strong", "surges", "surge"]);
const negative = new Set(["falls", "fall", "loss", "losses", "cuts", "cut", "downgrade", "downgrades", "weak", "drops", "drop", "probe", "risk", "declines", "decline"]);

export function headlineScore(title: string) {
  const words = title.toLowerCase().match(/[a-z]+/g) ?? [];
  const pos = words.filter((word) => positive.has(word)).length;
  const neg = words.filter((word) => negative.has(word)).length;
  return pos + neg ? (pos - neg) / (pos + neg) : 0;
}

export function newsSentiment(items: NewsItem[]) {
  if (!items.length) return { label: "Unavailable" as const, score: null, scored: 0 };
  const scores = items.map((item) => headlineScore(item.title)).filter((score) => score !== 0);
  const score = scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : 0;
  return { label: score > 0.15 ? "Positive" as const : score < -0.15 ? "Negative" as const : "Neutral" as const,
    score: Number(score.toFixed(2)), scored: scores.length };
}
