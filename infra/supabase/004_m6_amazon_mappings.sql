-- M6.1: owner-only Amazon Business ASIN/pack mappings; requires M3 migration 003.
-- No Amazon credentials, offers, orders, shipping addresses or payment instruments.
CREATE TABLE public.m6_amazon_mappings (
 sku text PRIMARY KEY REFERENCES public.materials(sku) ON DELETE RESTRICT,
 asin text NOT NULL CHECK (asin ~ '^[A-Z0-9]{10}$'),
 pack_quantity numeric(12,3) NOT NULL CHECK (pack_quantity > 0
     AND pack_quantity <= 100000 AND pack_quantity = round(pack_quantity,3)),
 max_unit_price_cents bigint CHECK (max_unit_price_cents BETWEEN 1 AND 100000000),
 enabled boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.m6_amazon_mappings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.m6_amazon_mappings FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.m6_amazon_mappings TO service_role;

CREATE FUNCTION public.m6_save_amazon_mapping(
 p_sku text,p_asin text,p_pack_quantity numeric,p_max_unit_price_cents bigint,p_enabled boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF p_sku IS NULL OR p_sku !~ '^[A-Z0-9][A-Z0-9_-]{1,39}$'
 OR p_asin IS NULL OR p_asin !~ '^[A-Z0-9]{10}$'
 OR p_pack_quantity IS NULL OR p_pack_quantity<=0 OR p_pack_quantity>100000
 OR p_pack_quantity<>round(p_pack_quantity,3) OR p_enabled IS NULL
 OR (p_max_unit_price_cents IS NOT NULL
     AND p_max_unit_price_cents NOT BETWEEN 1 AND 100000000)
 THEN RAISE EXCEPTION 'Invalid supplier mapping'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.materials WHERE sku=p_sku)
 THEN RAISE EXCEPTION 'Unknown material SKU'; END IF;
 INSERT INTO public.m6_amazon_mappings
  (sku,asin,pack_quantity,max_unit_price_cents,enabled)
 VALUES(p_sku,p_asin,p_pack_quantity,p_max_unit_price_cents,p_enabled)
 ON CONFLICT(sku) DO UPDATE SET
  asin=excluded.asin,pack_quantity=excluded.pack_quantity,
  max_unit_price_cents=excluded.max_unit_price_cents,
  enabled=excluded.enabled,updated_at=now();
 RETURN jsonb_build_object('sku',p_sku,'mapped',true,'checkout_enabled',false);
END $$;
REVOKE ALL ON FUNCTION public.m6_save_amazon_mapping(text,text,numeric,bigint,boolean)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.m6_save_amazon_mapping(text,text,numeric,bigint,boolean)
 TO service_role;
