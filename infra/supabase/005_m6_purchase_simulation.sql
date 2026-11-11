-- StarKeepsake M6.3: SIMULATED purchase intents and review audit trail.
-- Requires 003/004. No Amazon ordering role, external IDs, payment or shipping address.
-- Deliberately isolated from public.material_purchases (actual manually recorded orders).
CREATE TABLE public.m6_purchase_simulations (
 simulation_id uuid PRIMARY KEY,
 shop_id bigint NOT NULL CHECK(shop_id>0),
 fingerprint text NOT NULL UNIQUE CHECK(fingerprint ~ '^[a-f0-9]{64}$'),
 status text NOT NULL DEFAULT 'draft'
   CHECK(status IN('draft','simulated_reviewed','voided')),
 simulation_only boolean NOT NULL DEFAULT true CHECK(simulation_only=true),
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='array'
   AND jsonb_array_length(snapshot) BETWEEN 1 AND 20),
 estimated_subtotal_cents bigint NOT NULL
   CHECK(estimated_subtotal_cents BETWEEN 1 AND 100000000),
 per_order_cap_cents bigint NOT NULL CHECK(per_order_cap_cents BETWEEN 1 AND 100000000),
 daily_cap_cents bigint NOT NULL CHECK(daily_cap_cents BETWEEN 1 AND 100000000),
 blockers jsonb NOT NULL CHECK(jsonb_typeof(blockers)='array'
   AND jsonb_array_length(blockers) BETWEEN 1 AND 30),
 created_at timestamptz NOT NULL DEFAULT now(),
 reviewed_at timestamptz,
 voided_at timestamptz,
 CHECK(status<>'simulated_reviewed' OR reviewed_at IS NOT NULL),
 CHECK(status<>'voided' OR voided_at IS NOT NULL)
);
CREATE TABLE public.m6_simulation_events (
 event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 simulation_id uuid NOT NULL REFERENCES public.m6_purchase_simulations(simulation_id)
   ON DELETE RESTRICT,
 event_type text NOT NULL CHECK(event_type IN
   ('draft_created','simulated_reviewed','voided')),
 event_at timestamptz NOT NULL DEFAULT now(),
 details jsonb NOT NULL DEFAULT '{}'::jsonb
   CHECK(jsonb_typeof(details)='object')
);
CREATE INDEX m6_simulations_recent_idx ON
 public.m6_purchase_simulations(shop_id,created_at DESC);
CREATE INDEX m6_simulations_reviewed_idx ON
 public.m6_purchase_simulations(reviewed_at)
 WHERE status='simulated_reviewed';
ALTER TABLE public.m6_purchase_simulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.m6_simulation_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.m6_purchase_simulations,public.m6_simulation_events
 FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.m6_purchase_simulations TO service_role;
GRANT SELECT,INSERT ON public.m6_simulation_events TO service_role;

-- Idempotency is enforced in Postgres, not just in a browser.
CREATE FUNCTION public.m6_save_purchase_simulation(
 p_id uuid,p_shop_id bigint,p_fingerprint text,p_snapshot jsonb,
 p_estimated_cents bigint,p_per_order_cap bigint,p_daily_cap bigint,
 p_blockers jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE existing public.m6_purchase_simulations%ROWTYPE; n integer;
BEGIN
 IF p_id IS NULL OR p_shop_id IS NULL OR p_shop_id<=0
  OR p_fingerprint IS NULL OR p_fingerprint !~ '^[a-f0-9]{64}$'
  OR jsonb_typeof(p_snapshot)<>'array'
  OR jsonb_array_length(p_snapshot) NOT BETWEEN 1 AND 20
  OR jsonb_typeof(p_blockers)<>'array'
  OR jsonb_array_length(p_blockers) NOT BETWEEN 1 AND 30
  OR p_estimated_cents IS NULL OR p_estimated_cents NOT BETWEEN 1 AND 100000000
  OR p_per_order_cap IS NULL OR p_per_order_cap NOT BETWEEN 1 AND 100000000
  OR p_daily_cap IS NULL OR p_daily_cap NOT BETWEEN 1 AND 100000000
  THEN RAISE EXCEPTION 'Invalid simulation snapshot'; END IF;
 -- Validating supplied JSON is defense-in-depth; only authenticated owner API
 -- may call the service_role RPC, and the API recomputes data from M2/M3.
 SELECT count(*) INTO n FROM jsonb_array_elements(p_snapshot) AS x
 WHERE (x->>'sku') IS NULL OR (x->>'sku') !~ '^[A-Z0-9][A-Z0-9_-]{1,39}$'
   OR (x->>'asin') IS NULL OR (x->>'asin') !~ '^[A-Z0-9]{10}$'
   OR (x->>'packs') IS NULL OR (x->>'packs') !~ '^[1-9][0-9]{0,4}$'
   OR (x->>'estimatedCents') IS NULL OR
     (x->>'estimatedCents') !~ '^[1-9][0-9]{0,9}$';
 IF n>0 THEN RAISE EXCEPTION 'Invalid line item snapshot'; END IF;
 -- Serialize retries and concurrent unique-fingerprint inserts.
 PERFORM pg_advisory_xact_lock(hashtext('starkeepsake-m6-simulation-intents'));
 SELECT * INTO existing FROM public.m6_purchase_simulations
 WHERE fingerprint=p_fingerprint OR simulation_id=p_id LIMIT 1 FOR UPDATE;
 IF FOUND THEN
   IF existing.fingerprint<>p_fingerprint OR existing.shop_id<>p_shop_id
     OR existing.snapshot<>p_snapshot
     OR existing.estimated_subtotal_cents<>p_estimated_cents
     OR existing.per_order_cap_cents<>p_per_order_cap
     OR existing.daily_cap_cents<>p_daily_cap
     OR existing.blockers<>p_blockers
   THEN RAISE EXCEPTION 'Simulation idempotency key reused with changed data'; END IF;
   RETURN jsonb_build_object('simulation_id',existing.simulation_id,
     'status',existing.status,'replayed',true,'simulation_only',true);
 END IF;
 INSERT INTO public.m6_purchase_simulations(
  simulation_id,shop_id,fingerprint,snapshot,estimated_subtotal_cents,
  per_order_cap_cents,daily_cap_cents,blockers)
 VALUES(p_id,p_shop_id,p_fingerprint,p_snapshot,p_estimated_cents,
  p_per_order_cap,p_daily_cap,p_blockers);
 INSERT INTO public.m6_simulation_events(simulation_id,event_type)
 VALUES(p_id,'draft_created');
 RETURN jsonb_build_object('simulation_id',p_id,'status','draft',
   'replayed',false,'simulation_only',true);
END $$;

-- A SIMULATED review is not a purchase authorization. No external vendor I/O.
CREATE FUNCTION public.m6_review_purchase_simulation(
 p_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE intent public.m6_purchase_simulations%ROWTYPE;
        day_total bigint;
BEGIN
 IF p_id IS NULL THEN RAISE EXCEPTION 'Missing simulation ID'; END IF;
 -- One global lock makes simultaneous budget reviews deterministic.
 PERFORM pg_advisory_xact_lock(hashtext('starkeepsake-m6-simulation-review'));
 SELECT * INTO intent FROM public.m6_purchase_simulations
 WHERE simulation_id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown simulation'; END IF;
 IF intent.status='simulated_reviewed' THEN
  RETURN jsonb_build_object('simulation_id',p_id,'status',intent.status,
   'replayed',true,'simulation_only',true);
 END IF;
 IF intent.status<>'draft' THEN RAISE EXCEPTION 'Simulation already voided'; END IF;
 IF intent.created_at < now()-interval '30 minutes' THEN
  RAISE EXCEPTION 'Snapshot expired; re-evaluate first'; END IF;
 IF intent.estimated_subtotal_cents>intent.per_order_cap_cents THEN
  RAISE EXCEPTION 'Simulation exceeds per-order cap'; END IF;
 SELECT coalesce(sum(estimated_subtotal_cents),0) INTO day_total
 FROM public.m6_purchase_simulations
 WHERE status='simulated_reviewed'
   AND reviewed_at >= date_trunc('day',now())
   AND reviewed_at < date_trunc('day',now())+interval '1 day';
 IF day_total+intent.estimated_subtotal_cents>intent.daily_cap_cents
 THEN RAISE EXCEPTION 'Simulation exceeds remaining daily cap'; END IF;
 UPDATE public.m6_purchase_simulations
 SET status='simulated_reviewed',reviewed_at=now() WHERE simulation_id=p_id;
 INSERT INTO public.m6_simulation_events(simulation_id,event_type,details)
 VALUES(p_id,'simulated_reviewed',
  jsonb_build_object('prior_daily_simulated_cents',day_total));
 RETURN jsonb_build_object('simulation_id',p_id,
  'status','simulated_reviewed','simulation_only',true,'vendor_order_placed',false);
END $$;

CREATE FUNCTION public.m6_void_purchase_simulation(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE intent public.m6_purchase_simulations%ROWTYPE;
BEGIN
 IF p_id IS NULL THEN RAISE EXCEPTION 'Missing simulation ID'; END IF;
 SELECT * INTO intent FROM public.m6_purchase_simulations
 WHERE simulation_id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown simulation'; END IF;
 IF intent.status='simulated_reviewed'
 THEN RAISE EXCEPTION 'Reviewed simulation is an immutable audit record'; END IF;
 IF intent.status='draft' THEN
  UPDATE public.m6_purchase_simulations
  SET status='voided',voided_at=now() WHERE simulation_id=p_id;
  INSERT INTO public.m6_simulation_events(simulation_id,event_type)
  VALUES(p_id,'voided');
 END IF;
 RETURN jsonb_build_object('simulation_id',p_id,
  'status','voided','simulation_only',true,'vendor_order_placed',false);
END $$;

REVOKE ALL ON FUNCTION public.m6_save_purchase_simulation(
 uuid,bigint,text,jsonb,bigint,bigint,bigint,jsonb),
 public.m6_review_purchase_simulation(uuid),
 public.m6_void_purchase_simulation(uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.m6_save_purchase_simulation(
 uuid,bigint,text,jsonb,bigint,bigint,bigint,jsonb),
 public.m6_review_purchase_simulation(uuid),
 public.m6_void_purchase_simulation(uuid)
 TO service_role;
