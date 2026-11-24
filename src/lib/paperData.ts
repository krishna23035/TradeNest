import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type PageResult<T> = { data: T[] | null; error: { message: string } | null };

async function allRows<T>(page: (from: number, to: number) => PromiseLike<PageResult<T>>): Promise<T[]> {
  const rows: T[] = [];
  const size = 500;
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < size) return rows;
  }
}

export async function loadPaperLedger(userId: string) {
  const [orders, transactions] = await Promise.all([
    allRows<Tables<"orders">>((from, to) => supabase.from("orders").select("*")
      .eq("user_id", userId).order("created_at").order("id").range(from, to)),
    allRows<Tables<"transactions">>((from, to) => supabase.from("transactions").select("*")
      .eq("user_id", userId).order("created_at").order("id").range(from, to)),
  ]);
  const symbols = [...new Set(orders.map((order) => order.symbol))];
  const quotes = symbols.length
    ? await allRows<Tables<"paper_quote_history">>((from, to) => supabase.from("paper_quote_history")
      .select("*").in("symbol", symbols).order("captured_at").order("id").range(from, to))
    : [];
  return { orders, transactions, quotes };
}

export async function loadPaperReportSnapshot(userId: string) {
  const [ledger, holdingsResult, stocksResult, walletResult] = await Promise.all([
    loadPaperLedger(userId),
    supabase.from("holdings").select("*").eq("user_id", userId).order("symbol"),
    supabase.from("stocks").select("*").order("symbol"),
    supabase.from("wallets").select("*").eq("user_id", userId).single(),
  ]);
  for (const result of [holdingsResult, stocksResult, walletResult]) {
    if (result.error) throw new Error(result.error.message);
  }
  return {
    ...ledger,
    holdings: holdingsResult.data ?? [],
    stocks: stocksResult.data ?? [],
    wallet: walletResult.data!,
  };
}
