import Decimal from "decimal.js";

export type ExecutedOrder = {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  executed_price: number | null;
  executed_at: string | null;
  status: "PENDING" | "EXECUTED" | "CANCELLED";
};

export type RecordedQuote = {
  id: number;
  symbol: string;
  price: number;
  captured_at: string;
  source: string;
};

export type ValuationPoint = {
  time: string;
  value: number;
  cost: number;
  realizedPl: number;
  unrealizedPl: number;
  totalPl: number;
  event: string;
};

type Position = { quantity: number; cost: Decimal };

/** Values holdings only at recorded paper quote and executed-order events. */
export function portfolioValuationHistory(orders: ExecutedOrder[], quotes: RecordedQuote[]): ValuationPoint[] {
  const events = [
    ...quotes.map((quote) => ({ time: quote.captured_at, kind: "quote" as const, quote })),
    ...orders.filter((order) => order.status === "EXECUTED" && order.executed_at && order.executed_price !== null)
      .map((order) => ({ time: order.executed_at!, kind: "order" as const, order })),
  ].sort((left, right) => Date.parse(left.time) - Date.parse(right.time) ||
    (left.kind === right.kind ? 0 : left.kind === "quote" ? -1 : 1));

  const positions = new Map<string, Position>();
  const prices = new Map<string, Decimal>();
  let realized = new Decimal(0);
  const points: ValuationPoint[] = [];

  for (const event of events) {
    let label: string;
    if (event.kind === "quote") {
      prices.set(event.quote.symbol, new Decimal(event.quote.price));
      label = `${event.quote.symbol} recorded simulated quote`;
    } else {
      const { order } = event;
      const price = new Decimal(order.executed_price!);
      prices.set(order.symbol, price);
      const current = positions.get(order.symbol) ?? { quantity: 0, cost: new Decimal(0) };
      if (order.side === "BUY") {
        current.cost = current.cost.plus(price.times(order.quantity));
        current.quantity += order.quantity;
      } else {
        if (current.quantity < order.quantity) throw new Error(`Incomplete order history for ${order.symbol}`);
        const removed = current.cost.times(order.quantity).div(current.quantity).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
        current.cost = current.cost.minus(removed);
        current.quantity -= order.quantity;
        realized = realized.plus(price.times(order.quantity).minus(removed));
      }
      positions.set(order.symbol, current);
      label = `${order.side} ${order.quantity} ${order.symbol}`;
    }

    if (![...positions].some(([, position]) => position.quantity > 0)) continue;
    const value = [...positions].reduce((sum, [symbol, position]) =>
      sum.plus((prices.get(symbol) ?? new Decimal(0)).times(position.quantity)), new Decimal(0));
    const cost = [...positions.values()].reduce((sum, position) => sum.plus(position.cost), new Decimal(0));
    const unrealized = value.minus(cost);
    points.push({
      time: event.time,
      value: value.toNumber(),
      cost: cost.toNumber(),
      realizedPl: realized.toNumber(),
      unrealizedPl: unrealized.toNumber(),
      totalPl: realized.plus(unrealized).toNumber(),
      event: label,
    });
  }
  return points;
}

export function gainLossSummary(points: ValuationPoint[]) {
  if (!points.length) return null;
  const first = points[0];
  const last = points[points.length - 1];
  return {
    from: first.time,
    to: last.time,
    firstValue: first.value,
    lastValue: last.value,
    change: new Decimal(last.totalPl).minus(first.totalPl).toNumber(),
    highestValue: Math.max(...points.map((point) => point.value)),
    lowestValue: Math.min(...points.map((point) => point.value)),
    realizedPl: last.realizedPl,
    unrealizedPl: last.unrealizedPl,
  };
}
