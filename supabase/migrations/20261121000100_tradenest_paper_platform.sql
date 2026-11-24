-- TradeNest academic paper-trading backend. No payment or broker integration.
create table public.roles (
  id text primary key check (id in ('trader', 'broker', 'admin')),
  description text not null
);
insert into public.roles values
  ('trader', 'Paper trading and own records'),
  ('broker', 'Read-only support and audit access'),
  ('admin', 'User roles, simulated quotes and audit access');

create table public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role_id text not null default 'trader' references public.roles(id),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column kyc_status text not null default 'not_required_paper'
  check (kyc_status in ('not_required_paper', 'pending', 'verified', 'rejected'));

create table public.stocks (
  symbol text primary key check (symbol ~ '^[A-Z0-9.^-]{1,20}$'),
  company_name text not null,
  exchange text not null,
  sector text not null,
  last_price numeric(14, 2) not null check (last_price > 0),
  updated_at timestamptz not null default now(),
  quote_source text not null default 'simulated' check (quote_source = 'simulated')
);
insert into public.stocks (symbol, company_name, exchange, sector, last_price) values
  ('RELIANCE', 'Reliance Industries', 'NSE', 'Energy', 2750),
  ('TCS', 'Tata Consultancy Services', 'NSE', 'Technology', 3980),
  ('INFY', 'Infosys', 'NSE', 'Technology', 1500),
  ('HDFCBANK', 'HDFC Bank', 'NSE', 'Financials', 1650),
  ('ICICIBANK', 'ICICI Bank', 'NSE', 'Financials', 1248),
  ('ADANIENT', 'Adani Enterprises', 'NSE', 'Conglomerate', 2410),
  ('TATAMOTORS', 'Tata Motors', 'NSE', 'Auto', 985),
  ('AAPL', 'Apple', 'NASDAQ', 'Technology', 210),
  ('MSFT', 'Microsoft', 'NASDAQ', 'Technology', 420),
  ('GOOGL', 'Alphabet', 'NASDAQ', 'Technology', 175),
  ('NVDA', 'NVIDIA', 'NASDAQ', 'Technology', 125),
  ('TSLA', 'Tesla', 'NASDAQ', 'Auto', 248);

create table public.wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  available_balance numeric(16, 2) not null default 100000 check (available_balance >= 0),
  blocked_balance numeric(16, 2) not null default 0 check (blocked_balance >= 0),
  updated_at timestamptz not null default now()
);
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key uuid not null,
  symbol text not null references public.stocks(symbol),
  side text not null check (side in ('BUY', 'SELL')),
  quantity integer not null check (quantity > 0 and quantity <= 100000),
  order_kind text not null default 'MARKET' check (order_kind in ('MARKET', 'LIMIT')),
  limit_price numeric(14, 2) check (limit_price > 0),
  reserved_amount numeric(16, 2) not null default 0 check (reserved_amount >= 0),
  executed_price numeric(14, 2) check (executed_price > 0),
  status text not null default 'EXECUTED' check (status in ('PENDING', 'EXECUTED', 'CANCELLED')),
  created_at timestamptz not null default now(),
  executed_at timestamptz,
  check ((status = 'EXECUTED' and executed_price is not null and executed_at is not null) or
         (status in ('PENDING', 'CANCELLED') and executed_price is null)),
  unique (user_id, idempotency_key)
);
create index orders_user_created_idx on public.orders(user_id, created_at desc);
create index orders_pending_symbol_idx on public.orders(symbol) where status = 'PENDING';
create table public.holdings (
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null references public.stocks(symbol),
  quantity integer not null check (quantity >= 0),
  cost_basis numeric(16, 2) not null check (cost_basis >= 0),
  avg_price numeric(20, 8) not null check (avg_price >= 0),
  realized_pl numeric(16, 2) not null default 0,
  updated_at timestamptz not null default now(),
  check (quantity <> 0 or cost_basis = 0),
  primary key (user_id, symbol)
);
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid references public.orders(id),
  idempotency_key uuid,
  txn_type text not null check (txn_type in ('BUY', 'SELL', 'VIRTUAL_DEPOSIT', 'VIRTUAL_WITHDRAWAL')),
  amount numeric(16, 2) not null check (amount > 0),
  balance_after numeric(16, 2) not null check (balance_after >= 0),
  created_at timestamptz not null default now()
);
create index transactions_user_created_idx on public.transactions(user_id, created_at desc);
create unique index transactions_order_once_idx on public.transactions(order_id) where order_id is not null;
create unique index transactions_wallet_request_once_idx on public.transactions(user_id, idempotency_key)
  where idempotency_key is not null;
create table public.price_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null references public.stocks(symbol),
  target_price numeric(14, 2) not null check (target_price > 0),
  condition_type text not null check (condition_type in ('ABOVE', 'BELOW')),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'TRIGGERED', 'CANCELLED')),
  created_at timestamptz not null default now(),
  triggered_at timestamptz
);
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  message text not null,
  created_at timestamptz not null default now()
);
create index notifications_user_created_idx on public.notifications(user_id, created_at desc);
create table public.notification_templates (
  template_key text primary key,
  body text not null check (length(body) between 1 and 500),
  updated_at timestamptz not null default now()
);
insert into public.notification_templates(template_key, body) values
  ('wallet_adjusted', '{direction}: {amount} virtual credits.'),
  ('order_executed', '{side} {quantity} {symbol} at {price} simulated credits.'),
  ('limit_queued', '{side} {quantity} {symbol} at limit {price}.'),
  ('order_cancelled', 'Pending {side} order for {symbol} cancelled.'),
  ('limit_executed', '{side} {quantity} {symbol} at {price} simulated credits.'),
  ('price_alert', '{symbol} reached {price} simulated credits.');
create table public.ai_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_type text not null check (request_type in ('RISK', 'SIGNAL', 'SUMMARY', 'SENTIMENT')),
  input_summary text not null,
  ai_response text not null,
  created_at timestamptz not null default now()
);
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  report_type text not null check (report_type in ('PORTFOLIO', 'TRADE', 'STATEMENT')),
  file_name text not null,
  created_at timestamptz not null default now()
);
create table public.audit_logs (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs(created_at desc);
create table public.system_settings (
  singleton boolean primary key default true check (singleton),
  max_order_quantity integer not null default 1000 check (max_order_quantity between 1 and 100000),
  max_order_value numeric(16, 2) not null default 1000000 check (max_order_value > 0),
  max_orders_per_minute integer not null default 10 check (max_orders_per_minute between 1 and 100),
  updated_at timestamptz not null default now()
);
insert into public.system_settings(singleton) values(true);

create function public.notification_message(p_key text, p_values jsonb) returns text
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_body text; v_entry record;
begin
  select body into v_body from public.notification_templates where template_key = p_key;
  if v_body is null then raise exception 'Notification template missing: %', p_key; end if;
  for v_entry in select key, value from jsonb_each_text(p_values) loop
    v_body := replace(v_body, '{' || v_entry.key || '}', v_entry.value);
  end loop;
  return v_body;
end;
$$;

create function public.initialize_paper_account() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.user_roles(user_id) values (new.id) on conflict do nothing;
  insert into public.wallets(user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;
create trigger initialize_paper_account_after_signup after insert on auth.users
  for each row execute function public.initialize_paper_account();
insert into public.user_roles(user_id) select id from auth.users on conflict do nothing;
insert into public.wallets(user_id) select id from auth.users on conflict do nothing;

create function public.is_staff() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role_id in ('admin', 'broker'));
$$;
create function public.is_admin() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role_id = 'admin');
$$;

alter table public.roles enable row level security;
alter table public.user_roles enable row level security;
alter table public.stocks enable row level security;
alter table public.wallets enable row level security;
alter table public.orders enable row level security;
alter table public.holdings enable row level security;
alter table public.transactions enable row level security;
alter table public.price_alerts enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_templates enable row level security;
alter table public.ai_logs enable row level security;
alter table public.reports enable row level security;
alter table public.audit_logs enable row level security;
alter table public.system_settings enable row level security;

create policy roles_read on public.roles for select to authenticated using (true);
create policy user_roles_read on public.user_roles for select to authenticated using (user_id = auth.uid() or public.is_staff());
create policy stocks_read on public.stocks for select to authenticated using (true);
create policy wallets_read on public.wallets for select to authenticated using (user_id = auth.uid());
create policy orders_read on public.orders for select to authenticated using (user_id = auth.uid() or public.is_staff());
create policy holdings_read on public.holdings for select to authenticated using (user_id = auth.uid() or public.is_staff());
create policy transactions_read on public.transactions for select to authenticated using (user_id = auth.uid() or public.is_staff());
create policy price_alerts_read on public.price_alerts for select to authenticated using (user_id = auth.uid());
create policy price_alerts_insert on public.price_alerts for insert to authenticated with check (user_id = auth.uid() and status = 'ACTIVE');
create policy price_alerts_cancel on public.price_alerts for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and status = 'CANCELLED');
create policy notifications_read on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notification_templates_staff_read on public.notification_templates for select to authenticated using (public.is_staff());
create policy ai_logs_read on public.ai_logs for select to authenticated using (user_id = auth.uid() or public.is_staff());
create policy ai_logs_insert on public.ai_logs for insert to authenticated with check (user_id = auth.uid());
create policy reports_read on public.reports for select to authenticated using (user_id = auth.uid() or public.is_staff());
create policy reports_insert on public.reports for insert to authenticated with check (user_id = auth.uid());
create policy audit_logs_read on public.audit_logs for select to authenticated using (public.is_staff());
create policy system_settings_read on public.system_settings for select to authenticated using (true);
create policy profiles_staff_read on public.profiles for select to authenticated using (public.is_staff());

-- Supabase projects may grant broad default table privileges. Keep client writes narrow;
-- SECURITY DEFINER RPCs remain the only way to change financial records.
revoke all on public.roles, public.user_roles, public.stocks, public.wallets,
  public.orders, public.holdings, public.transactions, public.price_alerts,
  public.notifications, public.notification_templates, public.ai_logs,
  public.reports, public.audit_logs, public.system_settings,
  public.profiles, public.watchlist from public, anon, authenticated;
grant select on public.roles, public.user_roles, public.stocks, public.wallets,
  public.orders, public.holdings, public.transactions, public.price_alerts, public.notifications,
  public.ai_logs, public.reports, public.audit_logs, public.system_settings to authenticated;
grant select on public.notification_templates to authenticated;
grant insert(user_id, symbol, target_price, condition_type) on public.price_alerts to authenticated;
grant update(status) on public.price_alerts to authenticated;
grant insert on public.ai_logs, public.reports to authenticated;
grant select, insert, delete on public.watchlist to authenticated;
grant update(display_name, avatar_url) on public.profiles to authenticated;
grant insert(id, display_name, avatar_url) on public.profiles to authenticated;

-- The account and quote tables have no client write policy. All financial mutations use RPCs.
create function public.adjust_paper_wallet(p_amount numeric, p_direction text, p_idempotency_key uuid) returns numeric
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_user uuid := auth.uid(); v_balance numeric(16, 2); v_existing public.transactions%rowtype;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_idempotency_key is null then raise exception 'Idempotency key required'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > 1000000 or p_amount <> round(p_amount, 2) then
    raise exception 'Amount must be a positive virtual amount up to 1,000,000 with two decimals';
  end if;
  if p_direction not in ('VIRTUAL_DEPOSIT', 'VIRTUAL_WITHDRAWAL') then raise exception 'Invalid direction'; end if;
  insert into public.wallets(user_id) values(v_user) on conflict do nothing;
  select available_balance into v_balance from public.wallets where user_id = v_user for update;
  select * into v_existing from public.transactions
    where user_id = v_user and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.amount <> p_amount or v_existing.txn_type <> p_direction then
      raise exception 'Idempotency key reused with different wallet request';
    end if;
    return v_existing.balance_after;
  end if;
  if p_direction = 'VIRTUAL_WITHDRAWAL' and v_balance < p_amount then raise exception 'Insufficient virtual funds'; end if;
  v_balance := v_balance + case when p_direction = 'VIRTUAL_DEPOSIT' then p_amount else -p_amount end;
  update public.wallets set available_balance = v_balance, updated_at = now() where user_id = v_user;
  insert into public.transactions(user_id, idempotency_key, txn_type, amount, balance_after)
    values(v_user, p_idempotency_key, p_direction, p_amount, v_balance);
  insert into public.notifications(user_id, title, message) values
    (v_user, 'Virtual wallet updated', public.notification_message('wallet_adjusted',
      jsonb_build_object('direction', p_direction, 'amount', p_amount)));
  insert into public.audit_logs(user_id, action, details) values
    (v_user, 'paper_wallet_adjusted', jsonb_build_object('direction', p_direction, 'amount', p_amount));
  return v_balance;
end;
$$;

create function public.place_paper_order(p_symbol text, p_side text, p_quantity integer, p_idempotency_key uuid) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_user uuid := auth.uid(); v_symbol text := upper(trim(p_symbol)); v_price numeric(14, 2);
  v_total numeric(16, 2); v_balance numeric(16, 2); v_qty integer;
  v_cost_basis numeric(16, 2); v_cost_removed numeric(16, 2);
  v_order uuid; v_existing public.orders%rowtype; v_limit_qty integer; v_limit_value numeric(16, 2); v_limit_rate integer;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_idempotency_key is null then raise exception 'Idempotency key required'; end if;
  select max_order_quantity, max_order_value, max_orders_per_minute
    into v_limit_qty, v_limit_value, v_limit_rate from public.system_settings where singleton = true;
  if p_side not in ('BUY', 'SELL') or p_quantity is null or p_quantity < 1 or p_quantity > v_limit_qty then
    raise exception 'Invalid side or quantity';
  end if;
  -- Lock the quote before the wallet so price updates cannot race execution.
  select last_price into v_price from public.stocks where symbol = v_symbol for share;
  if v_price is null then raise exception 'Unknown simulated stock'; end if;
  insert into public.wallets(user_id) values(v_user) on conflict do nothing;
  select available_balance into v_balance from public.wallets where user_id = v_user for update;
  select * into v_existing from public.orders where user_id = v_user and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.symbol <> v_symbol or v_existing.side <> p_side or
      v_existing.quantity <> p_quantity or v_existing.order_kind <> 'MARKET' then
      raise exception 'Idempotency key reused with different order';
    end if;
    return v_existing.id;
  end if;
  v_total := round(v_price * p_quantity, 2);
  if v_total > v_limit_value then raise exception 'Paper order exceeds configured value limit'; end if;
  if (select count(*) from public.orders where user_id = v_user and created_at > now() - interval '1 minute') >= v_limit_rate then
    raise exception 'Paper order rate limit reached';
  end if;
  if p_side = 'BUY' then
    if v_balance < v_total then raise exception 'Insufficient virtual funds'; end if;
    insert into public.holdings(user_id, symbol, quantity, cost_basis, avg_price)
      values(v_user, v_symbol, p_quantity, v_total, v_price)
      on conflict (user_id, symbol) do update set
        avg_price = round((public.holdings.cost_basis + v_total) /
          (public.holdings.quantity + p_quantity), 8),
        cost_basis = public.holdings.cost_basis + v_total,
        quantity = public.holdings.quantity + p_quantity, updated_at = now();
    v_balance := v_balance - v_total;
  else
    select quantity, cost_basis into v_qty, v_cost_basis from public.holdings
      where user_id = v_user and symbol = v_symbol for update;
    if v_qty is null or v_qty - (select coalesce(sum(quantity), 0) from public.orders
      where user_id = v_user and symbol = v_symbol and side = 'SELL' and status = 'PENDING') < p_quantity then
      raise exception 'Insufficient unreserved paper holdings';
    end if;
    v_cost_removed := round(v_cost_basis * p_quantity / v_qty, 2);
    update public.holdings set quantity = quantity - p_quantity,
      cost_basis = cost_basis - v_cost_removed,
      avg_price = case when quantity = p_quantity then 0
        else round((cost_basis - v_cost_removed) / (quantity - p_quantity), 8) end,
      realized_pl = realized_pl + v_total - v_cost_removed, updated_at = now()
      where user_id = v_user and symbol = v_symbol;
    v_balance := v_balance + v_total;
  end if;
  update public.wallets set available_balance = v_balance, updated_at = now() where user_id = v_user;
  insert into public.orders(user_id, idempotency_key, symbol, side, quantity, order_kind, executed_price, status, executed_at)
    values(v_user, p_idempotency_key, v_symbol, p_side, p_quantity, 'MARKET', v_price, 'EXECUTED', now()) returning id into v_order;
  insert into public.transactions(user_id, order_id, txn_type, amount, balance_after)
    values(v_user, v_order, p_side, v_total, v_balance);
  insert into public.notifications(user_id, title, message) values
    (v_user, 'Paper order executed', public.notification_message('order_executed',
      jsonb_build_object('side', p_side, 'quantity', p_quantity, 'symbol', v_symbol, 'price', v_price)));
  insert into public.audit_logs(user_id, action, details) values
    (v_user, 'paper_order_executed', jsonb_build_object('order_id', v_order, 'symbol', v_symbol,
      'side', p_side, 'quantity', p_quantity, 'simulated_price', v_price));
  return v_order;
end;
$$;

create function public.place_paper_limit_order(p_symbol text, p_side text, p_quantity integer, p_limit_price numeric, p_idempotency_key uuid) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_user uuid := auth.uid(); v_symbol text := upper(trim(p_symbol)); v_quote numeric(14, 2);
  v_reserved numeric(16, 2); v_available numeric(16, 2); v_held integer;
  v_limit_qty integer; v_limit_value numeric(16, 2); v_limit_rate integer; v_order uuid;
  v_existing public.orders%rowtype;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_idempotency_key is null then raise exception 'Idempotency key required'; end if;
  select max_order_quantity, max_order_value, max_orders_per_minute
    into v_limit_qty, v_limit_value, v_limit_rate from public.system_settings where singleton = true;
  if p_side not in ('BUY', 'SELL') or p_quantity is null or p_quantity < 1 or p_quantity > v_limit_qty then
    raise exception 'Invalid side or quantity';
  end if;
  if p_limit_price is null or p_limit_price <= 0 or p_limit_price <> round(p_limit_price, 2) then
    raise exception 'Invalid limit price';
  end if;
  v_reserved := round(p_limit_price * p_quantity, 2);
  if v_reserved > v_limit_value then raise exception 'Paper order exceeds configured value limit'; end if;
  select last_price into v_quote from public.stocks where symbol = v_symbol for share;
  if v_quote is null then raise exception 'Unknown simulated stock'; end if;
  insert into public.wallets(user_id) values(v_user) on conflict do nothing;
  select available_balance into v_available from public.wallets where user_id = v_user for update;
  select * into v_existing from public.orders where user_id = v_user and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.symbol <> v_symbol or v_existing.side <> p_side or
      v_existing.quantity <> p_quantity or v_existing.order_kind <> 'LIMIT' or
      v_existing.limit_price <> p_limit_price then
      raise exception 'Idempotency key reused with different order';
    end if;
    return v_existing.id;
  end if;
  if (p_side = 'BUY' and p_limit_price >= v_quote) or (p_side = 'SELL' and p_limit_price <= v_quote) then
    raise exception 'Limit already marketable; use an instant paper order';
  end if;
  if (select count(*) from public.orders where user_id = v_user and created_at > now() - interval '1 minute') >= v_limit_rate then
    raise exception 'Paper order rate limit reached';
  end if;
  if p_side = 'BUY' then
    if v_available < v_reserved then raise exception 'Insufficient virtual funds'; end if;
    update public.wallets set available_balance = available_balance - v_reserved,
      blocked_balance = blocked_balance + v_reserved, updated_at = now() where user_id = v_user;
  else
    select quantity into v_held from public.holdings where user_id = v_user and symbol = v_symbol for update;
    if v_held is null or v_held - (select coalesce(sum(quantity), 0) from public.orders
      where user_id = v_user and symbol = v_symbol and side = 'SELL' and status = 'PENDING') < p_quantity then
      raise exception 'Insufficient unreserved paper holdings';
    end if;
  end if;
  insert into public.orders(user_id, idempotency_key, symbol, side, quantity, order_kind, limit_price, reserved_amount, status)
    values(v_user, p_idempotency_key, v_symbol, p_side, p_quantity, 'LIMIT', p_limit_price,
      case when p_side = 'BUY' then v_reserved else 0 end, 'PENDING') returning id into v_order;
  insert into public.notifications(user_id, title, message) values
    (v_user, 'Limit paper order queued', public.notification_message('limit_queued',
      jsonb_build_object('side', p_side, 'quantity', p_quantity, 'symbol', v_symbol, 'price', p_limit_price)));
  insert into public.audit_logs(user_id, action, details) values
    (v_user, 'paper_limit_order_placed', jsonb_build_object('order_id', v_order, 'symbol', v_symbol,
      'side', p_side, 'quantity', p_quantity, 'limit_price', p_limit_price));
  return v_order;
end;
$$;

create function public.cancel_paper_order(p_order uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_user uuid := auth.uid(); v_order public.orders%rowtype;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select * into v_order from public.orders where id = p_order and user_id = v_user for update;
  if not found or v_order.status <> 'PENDING' then raise exception 'Pending order not found'; end if;
  if v_order.side = 'BUY' then
    update public.wallets set available_balance = available_balance + v_order.reserved_amount,
      blocked_balance = blocked_balance - v_order.reserved_amount, updated_at = now()
      where user_id = v_user;
  end if;
  update public.orders set status = 'CANCELLED' where id = p_order;
  insert into public.notifications(user_id, title, message) values
    (v_user, 'Paper order cancelled', public.notification_message('order_cancelled',
      jsonb_build_object('side', v_order.side, 'symbol', v_order.symbol)));
  insert into public.audit_logs(user_id, action, details) values
    (v_user, 'paper_order_cancelled', jsonb_build_object('order_id', p_order));
end;
$$;

-- Private settlement helper, callable only from the admin quote update transaction.
create function public.settle_pending_paper_order(p_order uuid, p_price numeric) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_order public.orders%rowtype; v_total numeric(16, 2); v_balance numeric(16, 2);
  v_qty integer; v_cost_basis numeric(16, 2); v_cost_removed numeric(16, 2);
begin
  select * into v_order from public.orders where id = p_order and status = 'PENDING' for update;
  if not found then return; end if;
  v_total := round(p_price * v_order.quantity, 2);
  select available_balance into v_balance from public.wallets where user_id = v_order.user_id for update;
  if v_order.side = 'BUY' then
    update public.wallets set available_balance = available_balance + v_order.reserved_amount - v_total,
      blocked_balance = blocked_balance - v_order.reserved_amount, updated_at = now()
      where user_id = v_order.user_id;
    v_balance := v_balance + v_order.reserved_amount - v_total;
    insert into public.holdings(user_id, symbol, quantity, cost_basis, avg_price)
      values(v_order.user_id, v_order.symbol, v_order.quantity, v_total, p_price)
      on conflict (user_id, symbol) do update set
        avg_price = round((public.holdings.cost_basis + v_total) /
          (public.holdings.quantity + v_order.quantity), 8),
        cost_basis = public.holdings.cost_basis + v_total,
        quantity = public.holdings.quantity + v_order.quantity, updated_at = now();
  else
    select quantity, cost_basis into v_qty, v_cost_basis from public.holdings
      where user_id = v_order.user_id and symbol = v_order.symbol for update;
    if v_qty is null or v_qty < v_order.quantity then raise exception 'Reserved holding no longer available'; end if;
    v_cost_removed := round(v_cost_basis * v_order.quantity / v_qty, 2);
    update public.holdings set quantity = quantity - v_order.quantity,
      cost_basis = cost_basis - v_cost_removed,
      avg_price = case when quantity = v_order.quantity then 0
        else round((cost_basis - v_cost_removed) / (quantity - v_order.quantity), 8) end,
      realized_pl = realized_pl + v_total - v_cost_removed, updated_at = now()
      where user_id = v_order.user_id and symbol = v_order.symbol and quantity >= v_order.quantity;
    if not found then raise exception 'Reserved holding no longer available'; end if;
    update public.wallets set available_balance = available_balance + v_total, updated_at = now()
      where user_id = v_order.user_id;
    v_balance := v_balance + v_total;
  end if;
  update public.orders set status = 'EXECUTED', executed_price = p_price, executed_at = now() where id = p_order;
  insert into public.transactions(user_id, order_id, txn_type, amount, balance_after)
    values(v_order.user_id, p_order, v_order.side, v_total, v_balance);
  insert into public.notifications(user_id, title, message) values
    (v_order.user_id, 'Limit paper order executed', public.notification_message('limit_executed',
      jsonb_build_object('side', v_order.side, 'quantity', v_order.quantity, 'symbol', v_order.symbol, 'price', p_price)));
  insert into public.audit_logs(user_id, action, details) values
    (v_order.user_id, 'paper_limit_order_executed', jsonb_build_object('order_id', p_order, 'simulated_price', p_price));
end;
$$;

create function public.set_simulated_quote(p_symbol text, p_price numeric) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_symbol text := upper(trim(p_symbol)); v_pending record;
begin
  if not public.is_admin() then raise exception 'Admin role required'; end if;
  if p_price is null or p_price <= 0 or p_price > 100000000 or p_price <> round(p_price, 2) then
    raise exception 'Invalid simulated price';
  end if;
  update public.stocks set last_price = p_price, updated_at = now() where symbol = v_symbol;
  if not found then raise exception 'Unknown simulated stock'; end if;
  with triggered as (
    update public.price_alerts set status = 'TRIGGERED', triggered_at = now()
      where symbol = v_symbol and status = 'ACTIVE' and
        ((condition_type = 'ABOVE' and p_price >= target_price) or
         (condition_type = 'BELOW' and p_price <= target_price))
      returning user_id, symbol
  )
  insert into public.notifications(user_id, title, message)
    select user_id, 'Simulated price alert', public.notification_message('price_alert',
      jsonb_build_object('symbol', symbol, 'price', p_price)) from triggered;
  for v_pending in select id from public.orders
    where symbol = v_symbol and status = 'PENDING' and
      ((side = 'BUY' and p_price <= limit_price) or (side = 'SELL' and p_price >= limit_price))
    order by created_at for update
  loop
    perform public.settle_pending_paper_order(v_pending.id, p_price);
  end loop;
  insert into public.audit_logs(user_id, action, details)
    values(auth.uid(), 'simulated_quote_updated', jsonb_build_object('symbol', v_symbol, 'price', p_price));
end;
$$;

create function public.update_trading_rules(p_max_quantity integer, p_max_value numeric, p_max_per_minute integer) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then raise exception 'Admin role required'; end if;
  update public.system_settings set max_order_quantity = p_max_quantity,
    max_order_value = p_max_value, max_orders_per_minute = p_max_per_minute, updated_at = now()
    where singleton = true;
  insert into public.audit_logs(user_id, action, details) values
    (auth.uid(), 'trading_rules_updated', jsonb_build_object('max_quantity', p_max_quantity,
      'max_value', p_max_value, 'max_per_minute', p_max_per_minute));
end;
$$;

create function public.set_notification_template(p_key text, p_body text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then raise exception 'Admin role required'; end if;
  if p_body is null or length(trim(p_body)) not between 1 and 500 then raise exception 'Invalid template'; end if;
  update public.notification_templates set body = trim(p_body), updated_at = now() where template_key = p_key;
  if not found then raise exception 'Unknown notification template'; end if;
  insert into public.audit_logs(user_id, action, details) values
    (auth.uid(), 'notification_template_changed', jsonb_build_object('template_key', p_key));
end;
$$;

create function public.set_kyc_status(p_user uuid, p_status text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then raise exception 'Admin role required'; end if;
  if p_status not in ('not_required_paper', 'pending', 'verified', 'rejected') then
    raise exception 'Invalid KYC status';
  end if;
  update public.profiles set kyc_status = p_status, updated_at = now() where id = p_user;
  if not found then raise exception 'Unknown profile'; end if;
  insert into public.audit_logs(user_id, action, details) values
    (auth.uid(), 'kyc_status_changed', jsonb_build_object('target_user', p_user, 'status', p_status));
end;
$$;

create function public.upsert_simulated_stock(p_symbol text, p_name text, p_exchange text, p_sector text, p_price numeric) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_symbol text := upper(trim(p_symbol));
begin
  if not public.is_admin() then raise exception 'Admin role required'; end if;
  if v_symbol !~ '^[A-Z0-9.^-]{1,20}$' or length(trim(p_name)) < 2 or
    length(trim(p_exchange)) < 2 or length(trim(p_sector)) < 2 or
    p_price is null or p_price <= 0 or p_price <> round(p_price, 2) then
    raise exception 'Invalid simulated stock';
  end if;
  insert into public.stocks(symbol, company_name, exchange, sector, last_price)
    values(v_symbol, trim(p_name), trim(p_exchange), trim(p_sector), p_price)
    on conflict (symbol) do update set company_name = excluded.company_name,
      exchange = excluded.exchange, sector = excluded.sector,
      updated_at = now();
  perform public.set_simulated_quote(v_symbol, p_price);
  insert into public.audit_logs(user_id, action, details) values
    (auth.uid(), 'simulated_stock_upserted', jsonb_build_object('symbol', v_symbol, 'price', p_price));
end;
$$;

create function public.audit_report_export() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.audit_logs(user_id, action, details) values
    (new.user_id, 'report_exported', jsonb_build_object('report_type', new.report_type, 'file_name', new.file_name));
  return new;
end;
$$;
create trigger audit_report_export_after_insert after insert on public.reports
  for each row execute function public.audit_report_export();

create function public.set_user_role(p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then raise exception 'Admin role required'; end if;
  if p_role not in ('trader', 'broker', 'admin') then raise exception 'Invalid role'; end if;
  if p_user = auth.uid() and p_role <> 'admin' then raise exception 'Cannot remove own admin role'; end if;
  update public.user_roles set role_id = p_role, updated_at = now() where user_id = p_user;
  if not found then raise exception 'Unknown user'; end if;
  insert into public.audit_logs(user_id, action, details)
    values(auth.uid(), 'user_role_changed', jsonb_build_object('target_user', p_user, 'role', p_role));
end;
$$;

revoke all on function public.initialize_paper_account() from public, anon, authenticated;
revoke all on function public.settle_pending_paper_order(uuid, numeric) from public, anon, authenticated;
revoke all on function public.audit_report_export() from public, anon, authenticated;
revoke all on function public.notification_message(text, jsonb) from public, anon, authenticated;
revoke all on function public.adjust_paper_wallet(numeric, text, uuid) from public, anon;
revoke all on function public.place_paper_order(text, text, integer, uuid) from public, anon;
revoke all on function public.place_paper_limit_order(text, text, integer, numeric, uuid) from public, anon;
revoke all on function public.cancel_paper_order(uuid) from public, anon;
revoke all on function public.set_simulated_quote(text, numeric) from public, anon;
revoke all on function public.set_user_role(uuid, text) from public, anon;
revoke all on function public.update_trading_rules(integer, numeric, integer) from public, anon;
revoke all on function public.set_kyc_status(uuid, text) from public, anon;
revoke all on function public.upsert_simulated_stock(text, text, text, text, numeric) from public, anon;
revoke all on function public.set_notification_template(text, text) from public, anon;
grant execute on function public.adjust_paper_wallet(numeric, text, uuid) to authenticated;
grant execute on function public.place_paper_order(text, text, integer, uuid) to authenticated;
grant execute on function public.place_paper_limit_order(text, text, integer, numeric, uuid) to authenticated;
grant execute on function public.cancel_paper_order(uuid) to authenticated;
grant execute on function public.set_simulated_quote(text, numeric) to authenticated;
grant execute on function public.set_user_role(uuid, text) to authenticated;
grant execute on function public.update_trading_rules(integer, numeric, integer) to authenticated;
grant execute on function public.set_kyc_status(uuid, text) to authenticated;
grant execute on function public.upsert_simulated_stock(text, text, text, text, numeric) to authenticated;
grant execute on function public.set_notification_template(text, text) to authenticated;
