-- StarKeepsake M3: manual materials, inventory ledger, recipe snapshots and estimates.
-- No material pricing/quantities are seeded; no purchasing or fabrication actions.
CREATE TABLE public.materials (
  sku text PRIMARY KEY CHECK (sku ~ '^[A-Z0-9][A-Z0-9_-]{1,39}$'),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 2 AND 120),
  category text NOT NULL DEFAULT 'other' CHECK (category IN
    ('frame','photo','lighting','electronics','mounting','packaging','consumable','other')),
  unit text NOT NULL CHECK (unit IN ('each','ft','m','sheet','ml')),
  unit_cost_cents bigint CHECK (unit_cost_cents BETWEEN 0 AND 100000000),
  on_hand numeric(12,3) NOT NULL DEFAULT 0 CHECK (on_hand >= 0),
  reorder_at numeric(12,3) NOT NULL DEFAULT 0 CHECK (reorder_at >= 0),
  supplier_name text CHECK (length(supplier_name) <= 120),
  supplier_url text CHECK (supplier_url IS NULL OR
     (length(supplier_url) <= 500 AND supplier_url ~ '^https://[^[:space:]]+$')),
  notes text CHECK (length(notes) <= 500),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.material_recipes (
  recipe_code text PRIMARY KEY CHECK (recipe_code ~ '^[a-z0-9][a-z0-9_-]{2,49}$'),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 3 AND 120),
  finish text NOT NULL CHECK (finish IN ('any','walnut','oak','ebony')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.material_recipe_lines (
  recipe_code text NOT NULL REFERENCES public.material_recipes(recipe_code) ON DELETE CASCADE,
  sku text NOT NULL REFERENCES public.materials(sku) ON DELETE RESTRICT,
  quantity_per_frame numeric(12,3) NOT NULL CHECK (quantity_per_frame > 0 AND quantity_per_frame <= 10000),
  waste_percent numeric(6,2) NOT NULL DEFAULT 0 CHECK (waste_percent BETWEEN 0 AND 100),
  PRIMARY KEY (recipe_code,sku)
);
CREATE TABLE public.material_stock_movements (
  movement_id uuid PRIMARY KEY,
  sku text NOT NULL REFERENCES public.materials(sku) ON DELETE RESTRICT,
  delta numeric(12,3) NOT NULL CHECK (delta <> 0 AND delta BETWEEN -100000 AND 100000),
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 3 AND 200),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.job_material_plans (
  shop_id bigint NOT NULL,
  receipt_id bigint NOT NULL,
  transaction_id bigint NOT NULL,
  design_id text NOT NULL REFERENCES public.customer_designs(design_id),
  recipe_code text NOT NULL REFERENCES public.material_recipes(recipe_code),
  finish text NOT NULL CHECK (finish IN ('walnut','oak','ebony')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','reviewed','hold')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (shop_id,receipt_id,transaction_id),
  FOREIGN KEY (shop_id,receipt_id,transaction_id)
    REFERENCES public.production_jobs(shop_id,receipt_id,transaction_id) ON DELETE RESTRICT
);
CREATE TABLE public.job_material_lines (
  shop_id bigint NOT NULL,
  receipt_id bigint NOT NULL,
  transaction_id bigint NOT NULL,
  sku text NOT NULL REFERENCES public.materials(sku) ON DELETE RESTRICT,
  name_snapshot text NOT NULL,
  unit_snapshot text NOT NULL,
  quantity_required numeric(12,3) NOT NULL CHECK (quantity_required > 0),
  unit_cost_cents_snapshot bigint CHECK (unit_cost_cents_snapshot >= 0),
  PRIMARY KEY (shop_id,receipt_id,transaction_id,sku),
  FOREIGN KEY (shop_id,receipt_id,transaction_id)
    REFERENCES public.job_material_plans(shop_id,receipt_id,transaction_id) ON DELETE RESTRICT
);
CREATE INDEX job_material_lines_sku_idx ON public.job_material_lines(sku);
CREATE INDEX material_stock_movement_sku_idx ON public.material_stock_movements(sku,created_at DESC);

ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_recipe_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_material_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_material_lines ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.materials,public.material_recipes,public.material_recipe_lines,
 public.material_stock_movements,public.job_material_plans,public.job_material_lines
 FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.materials,public.material_recipes,public.material_recipe_lines,
 public.material_stock_movements,public.job_material_plans,public.job_material_lines TO service_role;
GRANT DELETE ON public.material_recipe_lines TO service_role;

-- SECURITY INVOKER: only server secret-key role can execute. Never make available to client.
CREATE FUNCTION public.m3_save_material(p_material jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE s text; n text; cat text; u text; price bigint; reorder numeric; vendor text; url text; note text;
BEGIN
  IF jsonb_typeof(p_material) <> 'object' THEN RAISE EXCEPTION 'Invalid material'; END IF;
  s := upper(btrim(p_material->>'sku'));
  n := btrim(p_material->>'name');
  cat := coalesce(p_material->>'category','other');
  u := p_material->>'unit';
  price := (p_material->>'unit_cost_cents')::bigint;
  reorder := (p_material->>'reorder_at')::numeric;
  vendor := nullif(btrim(p_material->>'supplier_name'),'');
  url := nullif(btrim(p_material->>'supplier_url'),'');
  note := nullif(btrim(p_material->>'notes'),'');
  IF s !~ '^[A-Z0-9][A-Z0-9_-]{1,39}$'
     OR length(n) NOT BETWEEN 2 AND 120
     OR cat NOT IN ('frame','photo','lighting','electronics','mounting','packaging','consumable','other')
     OR u NOT IN ('each','ft','m','sheet','ml')
     OR (price IS NOT NULL AND price NOT BETWEEN 0 AND 100000000)
     OR reorder IS NULL OR reorder < 0 OR reorder > 100000
     OR length(coalesce(vendor,'')) > 120 OR length(coalesce(note,'')) > 500
     OR (url IS NOT NULL AND (length(url)>500 OR url !~ '^https://[^[:space:]]+$'))
     THEN RAISE EXCEPTION 'Material validation failed'; END IF;
  INSERT INTO public.materials(sku,name,category,unit,unit_cost_cents,reorder_at,supplier_name,supplier_url,notes)
    VALUES(s,n,cat,u,price,reorder,vendor,url,note)
  ON CONFLICT (sku) DO UPDATE SET
    name=excluded.name,category=excluded.category,
    -- Preserve stock quantity, and never change unit for a part already counted or used.
    unit=excluded.unit,unit_cost_cents=excluded.unit_cost_cents,
    reorder_at=excluded.reorder_at,supplier_name=excluded.supplier_name,
    supplier_url=excluded.supplier_url,notes=excluded.notes,updated_at=now()
    WHERE public.materials.unit=excluded.unit;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cannot change an existing material unit'; END IF;
  RETURN jsonb_build_object('sku',s,'saved',true);
END $$;

CREATE FUNCTION public.m3_adjust_stock(
 p_sku text,p_delta numeric,p_reason text,p_movement_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE existing public.material_stock_movements%ROWTYPE; stock numeric;
BEGIN
 IF p_sku IS NULL OR p_delta IS NULL OR p_delta=0 OR abs(p_delta)>100000
   OR p_delta <> round(p_delta,3) OR length(btrim(coalesce(p_reason,''))) NOT BETWEEN 3 AND 200
   OR p_movement_id IS NULL THEN RAISE EXCEPTION 'Invalid stock adjustment'; END IF;
 -- Lock stock row before checking idempotency and updating. No stock is consumed by recipes.
 PERFORM 1 FROM public.materials WHERE sku=p_sku FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown material'; END IF;
 SELECT * INTO existing FROM public.material_stock_movements WHERE movement_id=p_movement_id;
 IF FOUND THEN
   IF existing.sku<>p_sku OR existing.delta<>p_delta OR existing.reason<>p_reason
     THEN RAISE EXCEPTION 'Stock adjustment key reused with other values'; END IF;
 ELSE
   UPDATE public.materials SET on_hand=on_hand+p_delta,updated_at=now()
   WHERE sku=p_sku AND on_hand+p_delta>=
     (SELECT coalesce(sum(a.quantity_allocated),0)
      FROM public.material_allocations a
      JOIN public.production_jobs p USING(shop_id,receipt_id,transaction_id)
      JOIN public.etsy_receipts e USING(shop_id,receipt_id)
      WHERE a.sku=p_sku AND p.status='awaiting_review' AND e.is_paid
        AND NOT e.is_canceled AND NOT e.has_refunds)
   RETURNING on_hand INTO stock;
   IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient inventory for adjustment'; END IF;
   INSERT INTO public.material_stock_movements(movement_id,sku,delta,reason)
   VALUES(p_movement_id,p_sku,p_delta,p_reason);
 END IF;
 SELECT on_hand INTO stock FROM public.materials WHERE sku=p_sku;
 RETURN jsonb_build_object('sku',p_sku,'on_hand',stock);
END $$;

CREATE FUNCTION public.m3_save_recipe(
 p_recipe_code text,p_name text,p_finish text,p_lines jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE line jsonb; part text; qty numeric; waste numeric; count_lines int:=0;
BEGIN
 IF p_recipe_code IS NULL OR p_recipe_code !~ '^[a-z0-9][a-z0-9_-]{2,49}$'
   OR length(btrim(coalesce(p_name,''))) NOT BETWEEN 3 AND 120
   OR p_finish NOT IN ('any','walnut','oak','ebony') OR
   jsonb_typeof(p_lines)<>'array' OR jsonb_array_length(p_lines) NOT BETWEEN 1 AND 60
   THEN RAISE EXCEPTION 'Invalid recipe'; END IF;
 INSERT INTO public.material_recipes(recipe_code,name,finish)
 VALUES(p_recipe_code,btrim(p_name),p_finish)
 ON CONFLICT(recipe_code) DO UPDATE SET name=excluded.name,finish=excluded.finish,updated_at=now();
 DELETE FROM public.material_recipe_lines WHERE recipe_code=p_recipe_code;
 FOR line IN SELECT value FROM jsonb_array_elements(p_lines) LOOP
   part := line->>'sku'; qty := (line->>'quantity_per_frame')::numeric;
   waste := coalesce((line->>'waste_percent')::numeric,0);
   IF part IS NULL OR qty IS NULL OR qty<=0 OR qty>10000 OR qty<>round(qty,3)
     OR waste<0 OR waste>100 THEN RAISE EXCEPTION 'Invalid recipe line'; END IF;
   INSERT INTO public.material_recipe_lines(recipe_code,sku,quantity_per_frame,waste_percent)
   VALUES(p_recipe_code,part,qty,waste);
   count_lines:=count_lines+1;
 END LOOP;
 RETURN jsonb_build_object('recipe_code',p_recipe_code,'lines',count_lines);
END $$;

CREATE FUNCTION public.m3_prepare_job_plan(
 p_shop_id bigint,p_receipt_id bigint,p_transaction_id bigint,p_recipe_code text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE j record; r record; finish_value text; plan record; n int;
BEGIN
 SELECT p.design_id,p.status AS job_status,i.match_state,i.quantity,
   e.is_paid,e.is_canceled,e.has_refunds,e.etsy_status,
   d.preferences_json->>'finish' AS finish
 INTO j FROM public.production_jobs p
 JOIN public.etsy_order_items i USING (shop_id,receipt_id,transaction_id)
 JOIN public.etsy_receipts e USING (shop_id,receipt_id)
 JOIN public.customer_designs d ON d.design_id=p.design_id
 WHERE p.shop_id=p_shop_id AND p.receipt_id=p_receipt_id
   AND p.transaction_id=p_transaction_id FOR UPDATE OF p;
 IF NOT FOUND OR j.job_status<>'awaiting_review' OR j.match_state<>'matched'
    OR j.quantity<>1 OR NOT j.is_paid OR j.is_canceled OR j.has_refunds
    OR j.etsy_status NOT IN ('paid','completed') THEN
   RAISE EXCEPTION 'Job is not eligible for BOM planning'; END IF;
 finish_value := j.finish;
 IF finish_value NOT IN ('oak','walnut','ebony') OR finish_value IS NULL THEN
    RAISE EXCEPTION 'Design wood finish cannot be verified'; END IF;
 SELECT recipe_code,finish INTO r FROM public.material_recipes
 WHERE recipe_code=p_recipe_code;
 IF NOT FOUND OR r.finish NOT IN ('any',finish_value) THEN
    RAISE EXCEPTION 'Recipe does not match the saved design finish'; END IF;
 SELECT recipe_code INTO plan FROM public.job_material_plans
 WHERE shop_id=p_shop_id AND receipt_id=p_receipt_id AND transaction_id=p_transaction_id;
 IF FOUND THEN
    IF plan.recipe_code<>p_recipe_code THEN
       RAISE EXCEPTION 'Existing BOM is immutable; review prior plan'; END IF;
 ELSE
   IF NOT EXISTS (SELECT 1 FROM public.material_recipe_lines WHERE recipe_code=p_recipe_code)
     THEN RAISE EXCEPTION 'Recipe has no materials'; END IF;
   INSERT INTO public.job_material_plans(shop_id,receipt_id,transaction_id,design_id,recipe_code,finish)
     VALUES(p_shop_id,p_receipt_id,p_transaction_id,j.design_id,p_recipe_code,finish_value);
   INSERT INTO public.job_material_lines(
     shop_id,receipt_id,transaction_id,sku,name_snapshot,unit_snapshot,quantity_required,unit_cost_cents_snapshot)
   SELECT p_shop_id,p_receipt_id,p_transaction_id,l.sku,m.name,m.unit,
     (ceil((l.quantity_per_frame*(1+l.waste_percent/100))*1000)/1000)::numeric(12,3),
     m.unit_cost_cents
   FROM public.material_recipe_lines l JOIN public.materials m USING(sku)
   WHERE l.recipe_code=p_recipe_code;
 END IF;
 SELECT count(*) INTO n FROM public.job_material_lines
 WHERE shop_id=p_shop_id AND receipt_id=p_receipt_id AND transaction_id=p_transaction_id;
 RETURN jsonb_build_object('shop_id',p_shop_id,'receipt_id',p_receipt_id,
   'transaction_id',p_transaction_id,'recipe_code',p_recipe_code,'line_count',n,
   'status','draft');
END $$;

REVOKE ALL ON FUNCTION public.m3_save_material(jsonb) FROM public,anon,authenticated;
REVOKE ALL ON FUNCTION public.m3_adjust_stock(text,numeric,text,uuid) FROM public,anon,authenticated;
REVOKE ALL ON FUNCTION public.m3_save_recipe(text,text,text,jsonb) FROM public,anon,authenticated;
REVOKE ALL ON FUNCTION public.m3_prepare_job_plan(bigint,bigint,bigint,text) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.m3_save_material(jsonb),
 public.m3_adjust_stock(text,numeric,text,uuid),
 public.m3_save_recipe(text,text,text,jsonb),
 public.m3_prepare_job_plan(bigint,bigint,bigint,text) TO service_role;

-- M3.1: OWNER-ENTERED supplier purchase receipts and per-job stock allocations.
-- These records NEVER create a vendor order or initiate a payment.
CREATE TABLE public.material_purchases (
  purchase_id uuid PRIMARY KEY,
  sku text NOT NULL REFERENCES public.materials(sku) ON DELETE RESTRICT,
  quantity_ordered numeric(12,3) NOT NULL CHECK (quantity_ordered > 0 AND quantity_ordered <= 100000),
  quantity_received numeric(12,3) NOT NULL DEFAULT 0 CHECK (quantity_received >= 0 AND quantity_received <= quantity_ordered),
  supplier_reference text NOT NULL CHECK (length(btrim(supplier_reference)) BETWEEN 3 AND 120),
  unit_cost_cents_snapshot bigint CHECK (unit_cost_cents_snapshot BETWEEN 0 AND 100000000),
  status text NOT NULL DEFAULT 'ordered' CHECK (status IN ('ordered','partially_received','received')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.material_purchase_receipts (
  receipt_id uuid PRIMARY KEY,
  purchase_id uuid NOT NULL REFERENCES public.material_purchases(purchase_id) ON DELETE RESTRICT,
  sku text NOT NULL REFERENCES public.materials(sku) ON DELETE RESTRICT,
  quantity numeric(12,3) NOT NULL CHECK (quantity > 0 AND quantity <= 100000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.material_allocations (
  shop_id bigint NOT NULL,
  receipt_id bigint NOT NULL,
  transaction_id bigint NOT NULL,
  sku text NOT NULL,
  quantity_allocated numeric(12,3) NOT NULL CHECK (quantity_allocated > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (shop_id,receipt_id,transaction_id,sku),
  FOREIGN KEY (shop_id,receipt_id,transaction_id,sku)
    REFERENCES public.job_material_lines(shop_id,receipt_id,transaction_id,sku)
    ON DELETE RESTRICT
);
CREATE INDEX material_purchases_sku_idx ON public.material_purchases(sku,created_at DESC);
CREATE INDEX material_allocations_sku_idx ON public.material_allocations(sku);
ALTER TABLE public.material_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_purchase_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_allocations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.material_purchases,public.material_purchase_receipts,
 public.material_allocations FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.material_purchases,public.material_purchase_receipts,
 public.material_allocations TO service_role;
GRANT DELETE ON public.material_allocations TO service_role;

CREATE FUNCTION public.m3_log_supplier_purchase(
  p_purchase_id uuid,p_sku text,p_qty numeric,p_reference text,p_unit_cost_cents bigint
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE existing public.material_purchases%ROWTYPE;
BEGIN
  IF p_purchase_id IS NULL OR p_sku IS NULL OR p_qty IS NULL
    OR p_qty<=0 OR p_qty>100000 OR p_qty<>round(p_qty,3)
    OR length(btrim(coalesce(p_reference,''))) NOT BETWEEN 3 AND 120
    OR (p_unit_cost_cents IS NOT NULL AND (p_unit_cost_cents<0 OR p_unit_cost_cents>100000000))
  THEN RAISE EXCEPTION 'Invalid supplier purchase record'; END IF;
  PERFORM 1 FROM public.materials WHERE sku=p_sku FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Material not found'; END IF;
  SELECT * INTO existing FROM public.material_purchases WHERE purchase_id=p_purchase_id FOR UPDATE;
  IF FOUND THEN
    IF existing.sku<>p_sku OR existing.quantity_ordered<>p_qty
      OR existing.supplier_reference<>btrim(p_reference)
      OR existing.unit_cost_cents_snapshot IS DISTINCT FROM p_unit_cost_cents
    THEN RAISE EXCEPTION 'Purchase ID reused with different values'; END IF;
  ELSE
    INSERT INTO public.material_purchases(purchase_id,sku,quantity_ordered,supplier_reference,unit_cost_cents_snapshot)
    VALUES(p_purchase_id,p_sku,p_qty,btrim(p_reference),p_unit_cost_cents);
  END IF;
  RETURN jsonb_build_object('purchase_id',p_purchase_id,'status','logged','vendor_order_placed',false);
END $$;

CREATE FUNCTION public.m3_receive_supplier_purchase(
  p_purchase_id uuid,p_receipt_id uuid,p_qty numeric
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE ordered public.material_purchases%ROWTYPE;
        existing public.material_purchase_receipts%ROWTYPE;
        new_total numeric;
BEGIN
  IF p_purchase_id IS NULL OR p_receipt_id IS NULL OR p_qty IS NULL
    OR p_qty<=0 OR p_qty>100000 OR p_qty<>round(p_qty,3)
  THEN RAISE EXCEPTION 'Invalid receipt request'; END IF;
  SELECT * INTO ordered FROM public.material_purchases WHERE purchase_id=p_purchase_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown supplier purchase'; END IF;
  -- Retry is harmless, but reusing an ID with another quantity/order is rejected.
  SELECT * INTO existing FROM public.material_purchase_receipts WHERE receipt_id=p_receipt_id;
  IF FOUND THEN
    IF existing.purchase_id<>p_purchase_id OR existing.quantity<>p_qty
    THEN RAISE EXCEPTION 'Receipt ID reuse mismatch'; END IF;
  ELSE
    new_total:=ordered.quantity_received+p_qty;
    IF new_total>ordered.quantity_ordered THEN RAISE EXCEPTION 'Over-receipt not permitted'; END IF;
    INSERT INTO public.material_purchase_receipts(receipt_id,purchase_id,sku,quantity)
      VALUES(p_receipt_id,p_purchase_id,ordered.sku,p_qty);
    UPDATE public.materials SET on_hand=on_hand+p_qty,updated_at=now() WHERE sku=ordered.sku;
    INSERT INTO public.material_stock_movements(movement_id,sku,delta,reason)
      VALUES(p_receipt_id,ordered.sku,p_qty,'Received supplier purchase '||p_purchase_id::text);
    UPDATE public.material_purchases SET quantity_received=new_total,
      status=CASE WHEN new_total=quantity_ordered THEN 'received' ELSE 'partially_received' END,
      updated_at=now() WHERE purchase_id=p_purchase_id;
  END IF;
  RETURN (SELECT jsonb_build_object('purchase_id',purchase_id,'received',quantity_received,
      'ordered',quantity_ordered,'status',status) FROM public.material_purchases WHERE purchase_id=p_purchase_id);
END $$;

CREATE FUNCTION public.m3_allocate_job_material(
 p_shop_id bigint,p_receipt_id bigint,p_transaction_id bigint,p_sku text,p_qty numeric
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE part public.materials%ROWTYPE; needed numeric; others numeric; j record;
BEGIN
 IF p_shop_id IS NULL OR p_shop_id<=0 OR p_receipt_id IS NULL OR p_receipt_id<=0
   OR p_transaction_id IS NULL OR p_transaction_id<=0 OR p_sku IS NULL
   OR p_qty IS NULL OR p_qty<0 OR p_qty>100000 OR p_qty<>round(p_qty,3)
 THEN RAISE EXCEPTION 'Invalid allocation'; END IF;
 -- Serialized by material row to prevent two workers double-reserving stock.
 SELECT * INTO part FROM public.materials WHERE sku=p_sku FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Material not found'; END IF;
 SELECT p.status,e.is_paid,e.is_canceled,e.has_refunds,e.etsy_status,
   i.match_state,i.quantity
 INTO j FROM public.production_jobs p
 JOIN public.etsy_receipts e USING(shop_id,receipt_id)
 JOIN public.etsy_order_items i USING(shop_id,receipt_id,transaction_id)
 WHERE p.shop_id=p_shop_id AND p.receipt_id=p_receipt_id AND p.transaction_id=p_transaction_id
 FOR UPDATE OF p;
 IF NOT FOUND OR j.status<>'awaiting_review' OR NOT j.is_paid OR j.is_canceled OR j.has_refunds
   OR j.etsy_status NOT IN ('paid','completed') OR j.match_state<>'matched' OR j.quantity<>1
 THEN RAISE EXCEPTION 'Only an active paid matched job can reserve stock'; END IF;
 SELECT quantity_required INTO needed FROM public.job_material_lines WHERE
   shop_id=p_shop_id AND receipt_id=p_receipt_id AND transaction_id=p_transaction_id AND sku=p_sku;
 IF NOT FOUND OR p_qty>needed THEN RAISE EXCEPTION 'Allocation exceeds job BOM'; END IF;
 SELECT coalesce(sum(a.quantity_allocated),0) INTO others
   FROM public.material_allocations a
   JOIN public.production_jobs p USING(shop_id,receipt_id,transaction_id)
   JOIN public.etsy_receipts e USING(shop_id,receipt_id)
   WHERE a.sku=p_sku AND p.status='awaiting_review' AND e.is_paid
     AND NOT e.is_canceled AND NOT e.has_refunds
     AND NOT (a.shop_id=p_shop_id AND a.receipt_id=p_receipt_id AND a.transaction_id=p_transaction_id);
 IF p_qty+others>part.on_hand THEN RAISE EXCEPTION 'Not enough unallocated stock'; END IF;
 IF p_qty=0 THEN
   DELETE FROM public.material_allocations WHERE shop_id=p_shop_id
     AND receipt_id=p_receipt_id AND transaction_id=p_transaction_id AND sku=p_sku;
 ELSE
   INSERT INTO public.material_allocations(shop_id,receipt_id,transaction_id,sku,quantity_allocated)
   VALUES(p_shop_id,p_receipt_id,p_transaction_id,p_sku,p_qty)
   ON CONFLICT(shop_id,receipt_id,transaction_id,sku)
   DO UPDATE SET quantity_allocated=excluded.quantity_allocated,updated_at=now();
 END IF;
 RETURN jsonb_build_object('shop_id',p_shop_id,'receipt_id',p_receipt_id,
   'transaction_id',p_transaction_id,'sku',p_sku,'reserved',p_qty);
END $$;

REVOKE ALL ON FUNCTION public.m3_log_supplier_purchase(uuid,text,numeric,text,bigint),
 public.m3_receive_supplier_purchase(uuid,uuid,numeric),
 public.m3_allocate_job_material(bigint,bigint,bigint,text,numeric) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.m3_log_supplier_purchase(uuid,text,numeric,text,bigint),
 public.m3_receive_supplier_purchase(uuid,uuid,numeric),
 public.m3_allocate_job_material(bigint,bigint,bigint,text,numeric) TO service_role;
