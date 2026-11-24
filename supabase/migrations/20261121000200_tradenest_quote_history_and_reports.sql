-- Recorded simulated quotes support honest, event-based paper portfolio history.
-- The initial row is a current snapshot at migration time, never a backdated price.
create table public.paper_quote_history (
  id bigint generated always as identity primary key,
  symbol text not null references public.stocks(symbol),
  price numeric(14, 2) not null check (price > 0),
  source text not null check (source in ('migration_snapshot', 'simulated_initial', 'simulated_update')),
  captured_at timestamptz not null default clock_timestamp()
);
create index paper_quote_history_symbol_time_idx
  on public.paper_quote_history(symbol, captured_at, id);
alter table public.paper_quote_history enable row level security;
create policy paper_quote_history_read on public.paper_quote_history
  for select to authenticated using (true);
revoke all on public.paper_quote_history from public, anon, authenticated;
grant select on public.paper_quote_history to authenticated;

insert into public.paper_quote_history(symbol, price, source)
  select symbol, last_price, 'migration_snapshot' from public.stocks;

create function public.record_paper_quote() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' or old.last_price is distinct from new.last_price then
    insert into public.paper_quote_history(symbol, price, source)
      values(new.symbol, new.last_price,
        case when tg_op = 'INSERT' then 'simulated_initial' else 'simulated_update' end);
  end if;
  return new;
end;
$$;
create trigger record_paper_quote_after_change
  after insert or update of last_price on public.stocks
  for each row execute function public.record_paper_quote();
revoke all on function public.record_paper_quote() from public, anon, authenticated;

alter table public.reports drop constraint reports_report_type_check;
alter table public.reports add constraint reports_report_type_check
  check (report_type in ('PORTFOLIO', 'TRADE', 'STATEMENT', 'PROFIT_LOSS'));

-- In-app, rate-limited rule warning when one holding dominates the paper portfolio.
create function public.warn_paper_concentration() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_total numeric(20, 2); v_largest numeric(20, 2); v_symbol text;
begin
  select sum(h.quantity * s.last_price) into v_total
    from public.holdings h join public.stocks s on s.symbol = h.symbol
    where h.user_id = new.user_id and h.quantity > 0;
  if v_total is null or v_total <= 0 then return new; end if;
  select h.quantity * s.last_price, h.symbol into v_largest, v_symbol
    from public.holdings h join public.stocks s on s.symbol = h.symbol
    where h.user_id = new.user_id and h.quantity > 0
    order by h.quantity * s.last_price desc, h.symbol limit 1;
  if v_largest / v_total >= 0.60 and not exists (
    select 1 from public.notifications
      where user_id = new.user_id and title = 'Paper portfolio concentration warning'
        and created_at > now() - interval '1 day'
  ) then
    insert into public.notifications(user_id, title, message)
      values(new.user_id, 'Paper portfolio concentration warning',
        v_symbol || ' represents ' || round(v_largest / v_total * 100, 1) ||
        '% of current simulated holdings value. Review diversification.');
  end if;
  return new;
end;
$$;
create trigger warn_paper_concentration_after_holding_change
  after insert or update of quantity, cost_basis on public.holdings
  for each row execute function public.warn_paper_concentration();
revoke all on function public.warn_paper_concentration() from public, anon, authenticated;
