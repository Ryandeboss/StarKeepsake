-- StarKeepsake M2 - Etsy paid receipts and production preparation.
-- Run only in StarKeepsake Supabase project. Designed for repeatable, atomic, idempotent ingestion.
-- Etsy PII (buyer names, emails, shipping addresses, raw notes) is deliberately not stored.

create table if not exists public.etsy_receipts (
  shop_id bigint not null check (shop_id > 0),
  receipt_id bigint not null check (receipt_id > 0),
  etsy_status text not null,
  is_paid boolean not null,
  is_canceled boolean not null,
  has_refunds boolean not null default false,
  grandtotal_amount bigint,
  grandtotal_divisor integer check (grandtotal_divisor > 0),
  currency_code text check (currency_code ~ '^[A-Z]{3}$'),
  created_at_etsy timestamptz,
  updated_at_etsy timestamptz,
  last_synced_at timestamptz not null default now(),
  primary key (shop_id, receipt_id)
);

create index if not exists etsy_receipts_last_synced_idx
  on public.etsy_receipts(last_synced_at desc);

create table if not exists public.etsy_order_items (
  shop_id bigint not null,
  receipt_id bigint not null,
  transaction_id bigint not null check (transaction_id > 0),
  listing_id bigint,
  title text not null,
  quantity integer not null check (quantity between 1 and 1000),
  design_id text,
  reference_state text not null check (
    reference_state in ('candidate','missing','ambiguous','invalid')
  ),
  match_state text not null check (
    match_state in ('matched','missing','ambiguous','invalid','design_not_found',
      'multiple_units_review','payment_review')
  ),
  last_synced_at timestamptz not null default now(),
  primary key (shop_id,receipt_id,transaction_id),
  foreign key (shop_id,receipt_id)
    references public.etsy_receipts(shop_id,receipt_id) on delete restrict,
  foreign key (design_id)
    references public.customer_designs(design_id) on delete restrict
    -- Unverified references are stored as NULL; never violate this FK.
);

create index if not exists etsy_items_receipt_idx on public.etsy_order_items(shop_id,receipt_id);
create index if not exists etsy_items_design_idx on public.etsy_order_items(design_id);

create table if not exists public.production_jobs (
  shop_id bigint not null,
  receipt_id bigint not null,
  transaction_id bigint not null,
  design_id text not null references public.customer_designs(design_id),
  status text not null default 'awaiting_review'
    check (status in ('awaiting_review','in_progress','complete','hold')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (shop_id,receipt_id,transaction_id),
  foreign key (shop_id,receipt_id,transaction_id)
    references public.etsy_order_items(shop_id,receipt_id,transaction_id) on delete restrict
);

-- Deduplicate webhook retries. No raw event body retained.
create table if not exists public.etsy_webhook_deliveries (
  webhook_id text primary key check (length(webhook_id) between 1 and 128),
  shop_id bigint not null,
  receipt_id bigint not null,
  event_type text not null check (event_type in ('order.paid','order.canceled','order.shipped','order.delivered')),
  received_at timestamptz not null default now()
);

alter table public.etsy_receipts enable row level security;
alter table public.etsy_order_items enable row level security;
alter table public.production_jobs enable row level security;
alter table public.etsy_webhook_deliveries enable row level security;

revoke all on public.etsy_receipts,public.etsy_order_items,
  public.production_jobs,public.etsy_webhook_deliveries from anon,authenticated;
grant select,insert,update on public.etsy_receipts,public.etsy_order_items,
  public.production_jobs,public.etsy_webhook_deliveries to service_role;

-- Invoker's rights, explicitly revoked from PUBLIC. Called only by the server's
-- secret key after re-fetching the actual Etsy receipt using the seller OAuth token.
-- All operations complete in a single Postgres transaction.
create or replace function public.m2_ingest_etsy_receipt(
  p_receipt jsonb,
  p_items jsonb,
  p_webhook_id text default null,
  p_event_type text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  shop_id_value bigint;
  receipt_id_value bigint;
  paid_value boolean;
  canceled_value boolean;
  refund_value boolean;
  v_item jsonb;
  v_candidate text;
  v_design text;
  v_match text;
  v_quantity integer;
  v_transaction_id bigint;
  v_matched integer := 0;
  v_needs_review integer := 0;
  v_jobs integer := 0;
begin
  if jsonb_typeof(p_receipt) <> 'object' or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) > 100 then
    raise exception 'Invalid receipt input';
  end if;

  shop_id_value := (p_receipt->>'shop_id')::bigint;
  receipt_id_value := (p_receipt->>'receipt_id')::bigint;
  paid_value := (p_receipt->>'is_paid')::boolean;
  canceled_value := (p_receipt->>'is_canceled')::boolean;
  refund_value := coalesce((p_receipt->>'has_refunds')::boolean,false);
  if shop_id_value is null or shop_id_value < 1 or receipt_id_value is null or
     receipt_id_value < 1 or paid_value is null or canceled_value is null or
     length(coalesce(p_receipt->>'etsy_status','')) > 80 then
    raise exception 'Invalid verified receipt fields';
  end if;

  if p_webhook_id is not null then
    if length(p_webhook_id) not between 1 and 128 or
       p_event_type not in ('order.paid','order.canceled','order.shipped','order.delivered') then
      raise exception 'Invalid verified webhook fields';
    end if;
    insert into public.etsy_webhook_deliveries(webhook_id,shop_id,receipt_id,event_type)
      values(p_webhook_id,shop_id_value,receipt_id_value,p_event_type)
      on conflict (webhook_id) do nothing;
    -- Even duplicate events re-check current Etsy state; ingestion is idempotent.
  end if;

  insert into public.etsy_receipts (
    shop_id,receipt_id,etsy_status,is_paid,is_canceled,has_refunds,
    grandtotal_amount,grandtotal_divisor,currency_code,
    created_at_etsy,updated_at_etsy,last_synced_at)
  values (
    shop_id_value,receipt_id_value,p_receipt->>'etsy_status',paid_value,canceled_value,refund_value,
    (p_receipt->>'grandtotal_amount')::bigint,
    (p_receipt->>'grandtotal_divisor')::int,
    p_receipt->>'currency_code',
    (p_receipt->>'created_at_etsy')::timestamptz,
    (p_receipt->>'updated_at_etsy')::timestamptz,now())
  on conflict (shop_id,receipt_id) do update set
    etsy_status=excluded.etsy_status,is_paid=excluded.is_paid,
    is_canceled=excluded.is_canceled,has_refunds=excluded.has_refunds,
    grandtotal_amount=excluded.grandtotal_amount,grandtotal_divisor=excluded.grandtotal_divisor,
    currency_code=excluded.currency_code,created_at_etsy=excluded.created_at_etsy,
    updated_at_etsy=excluded.updated_at_etsy,last_synced_at=now();

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_transaction_id := (v_item->>'transaction_id')::bigint;
    v_quantity := (v_item->>'quantity')::integer;
    v_candidate := v_item->>'candidate_design_id';
    if v_transaction_id is null or v_transaction_id < 1 or
       v_quantity is null or v_quantity not between 1 and 1000 then
      raise exception 'Invalid Etsy transaction';
    end if;

    v_design := null;
    v_match := v_item->>'reference_state';
    if v_match not in ('candidate','missing','ambiguous','invalid') or v_match is null then
      raise exception 'Invalid personalization match status';
    end if;
    if v_match = 'candidate' then
      if v_candidate is null or v_candidate !~ '^SK-[0-9A-F]{16}$' then
        v_match := 'invalid';
      elsif exists (select 1 from public.customer_designs d where d.design_id=v_candidate) then
        v_design := v_candidate;
        if not paid_value or canceled_value or refund_value or
           (p_receipt->>'etsy_status') not in ('paid','completed') then
          v_match := 'payment_review';
        elsif v_quantity > 1 then
          v_match := 'multiple_units_review';
        else
          v_match := 'matched';
        end if;
      else
        v_match := 'design_not_found';
      end if;
    end if;

    insert into public.etsy_order_items(
      shop_id,receipt_id,transaction_id,listing_id,title,quantity,
      design_id,reference_state,match_state,last_synced_at)
    values(shop_id_value,receipt_id_value,v_transaction_id,
      (v_item->>'listing_id')::bigint,left(coalesce(v_item->>'title','Untitled'),180),
      v_quantity,v_design,v_item->>'reference_state',v_match,now())
    on conflict (shop_id,receipt_id,transaction_id) do update set
      listing_id=excluded.listing_id,title=excluded.title,
      quantity=excluded.quantity,design_id=excluded.design_id,
      reference_state=excluded.reference_state,match_state=excluded.match_state,
      last_synced_at=now();

    if v_match <> 'matched' then
      -- A previously matched design may later be invalidated or canceled.
      -- Never leave an old production job ready for fabrication.
      update public.production_jobs set status='hold',updated_at=now()
      where shop_id=shop_id_value and receipt_id=receipt_id_value
        and transaction_id=v_transaction_id and status<>'hold';
    end if;

    if v_match='matched' then
      v_matched:=v_matched+1;
      insert into public.production_jobs(shop_id,receipt_id,transaction_id,design_id)
        values(shop_id_value,receipt_id_value,v_transaction_id,v_design)
        on conflict (shop_id,receipt_id,transaction_id) do nothing;
    else
      v_needs_review:=v_needs_review+1;
    end if;
  end loop;

  -- Do not fabricate any production readiness after a refund/cancellation.
  -- Existing jobs must be held, even if they were previously in progress.
  if canceled_value or refund_value or not paid_value or
     (p_receipt->>'etsy_status') not in ('paid','completed') then
    update public.production_jobs set status='hold',updated_at=now()
    where shop_id=shop_id_value and receipt_id=receipt_id_value
      and status <> 'hold';
  end if;

  select count(*) into v_jobs from public.production_jobs
  where shop_id=shop_id_value and receipt_id=receipt_id_value;

  return jsonb_build_object(
    'receipt_id',receipt_id_value,'matched_items',v_matched,
    'needs_review_items',v_needs_review,'production_jobs',v_jobs,
    'payment_verified',paid_value and not canceled_value and not refund_value and
       (p_receipt->>'etsy_status') in ('paid','completed'));
end;
$$;

revoke all on function public.m2_ingest_etsy_receipt(jsonb,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.m2_ingest_etsy_receipt(jsonb,jsonb,text,text) to service_role;
