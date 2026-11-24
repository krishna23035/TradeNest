import { describe, expect, it } from "vitest";
import { headlineScore, newsSentiment, type NewsItem } from "@/lib/newsSentiment";
import { generateCandles, generateSentiment } from "@/lib/market";

const item = (title: string): NewsItem => ({ uuid: title, title, publisher: "Example", link: "https://example.test/article", providerPublishTime: 1 });

describe("news provenance and heuristic sentiment", () => {
  it("does not create headlines when no verified feed is available", () => {
    expect(generateSentiment("DEMO")).toEqual({ score: 0, label: "Unavailable", headlines: [] });
    expect(newsSentiment([])).toEqual({ score: null, label: "Unavailable", scored: 0 });
  });

  it("scores only words from supplied headlines", () => {
    expect(headlineScore("Profit rises as growth surges")).toBe(1);
    expect(headlineScore("Profit falls after loss")).toBeCloseTo(-1 / 3);
    expect(newsSentiment([item("Profit rises"), item("Growth gains")])).toMatchObject({ label: "Positive", score: 1, scored: 2 });
  });

  it("uses the configured crypto base for clearly labeled demo candles", () => {
    expect(generateCandles("BTC-USD", 2)[0].close).toBeGreaterThan(10000);
  });
});
