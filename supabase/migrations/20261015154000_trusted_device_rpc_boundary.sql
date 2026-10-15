-- Stage 1: install secure RPCs before the app stops using direct table access.
-- The current production device table is empty, so the single-device invariant is safe to add.
CREATE UNIQUE INDEX IF NOT EXISTS user_devices_one_device_per_user_idx
  ON public.user_devices (user_id);

CREATE OR REPLACE FUNCTION public.verify_trusted_device(p_device_key text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR p_device_key IS NULL OR
     p_device_key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
      FROM public.user_devices
     WHERE user_id = uid AND device_key = p_device_key
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.bind_or_verify_trusted_device(
  p_device_key text,
  p_phone text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR p_device_key IS NULL OR
     p_device_key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN false;
  END IF;

  INSERT INTO public.user_devices (user_id, device_key, phone, last_seen_at)
  VALUES (uid, p_device_key, p_phone, pg_catalog.now())
  ON CONFLICT (user_id) DO UPDATE
    SET phone = COALESCE(EXCLUDED.phone, public.user_devices.phone),
        last_seen_at = pg_catalog.now()
    WHERE public.user_devices.device_key = EXCLUDED.device_key;

  RETURN FOUND;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_device_recovery_code(
  p_device_key text,
  p_code_hash text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR p_device_key IS NULL OR p_code_hash IS NULL OR
     p_device_key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' OR
     p_code_hash !~ '^[0-9a-f]{64}$' THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_devices
     WHERE user_id = uid AND device_key = p_device_key
  ) THEN
    RETURN false;
  END IF;

  DELETE FROM public.device_recovery_codes
   WHERE user_id = uid AND used_at IS NULL;

  INSERT INTO public.device_recovery_codes (user_id, code_hash, expires_at)
  VALUES (uid, p_code_hash, pg_catalog.now() + interval '15 minutes');

  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.consume_device_recovery_code(
  p_code_hash text,
  p_new_device_key text,
  p_phone text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  uid uuid := auth.uid();
  rid uuid;
  active_locked_until timestamptz;
BEGIN
  IF uid IS NULL OR p_code_hash IS NULL OR p_new_device_key IS NULL OR
     p_code_hash !~ '^[0-9a-f]{64}$' OR
     p_new_device_key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN false;
  END IF;

  SELECT id, locked_until INTO rid, active_locked_until
    FROM public.device_recovery_codes
   WHERE user_id = uid
     AND used_at IS NULL
     AND expires_at > pg_catalog.now()
   ORDER BY created_at DESC
   LIMIT 1
   FOR UPDATE;

  IF rid IS NULL OR
     (active_locked_until IS NOT NULL AND active_locked_until > pg_catalog.now()) THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.device_recovery_codes
     WHERE id = rid
       AND code_hash = p_code_hash
       AND used_at IS NULL
       AND expires_at > pg_catalog.now()
  ) THEN
    UPDATE public.device_recovery_codes
       SET attempt_count = attempt_count + 1,
           locked_until = CASE
             WHEN attempt_count + 1 >= 10 THEN pg_catalog.now() + interval '5 minutes'
             ELSE locked_until
           END
     WHERE id = rid;
    RETURN false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.user_devices WHERE user_id = uid) THEN
    RETURN false;
  END IF;

  UPDATE public.device_recovery_codes
     SET used_at = pg_catalog.now()
   WHERE id = rid;

  UPDATE public.user_devices
     SET device_key = p_new_device_key,
         phone = COALESCE(p_phone, phone),
         last_seen_at = pg_catalog.now()
   WHERE user_id = uid;

  RETURN FOUND;
END;
$function$;

REVOKE ALL ON FUNCTION public.verify_trusted_device(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.bind_or_verify_trusted_device(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_device_recovery_code(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.consume_device_recovery_code(text, text, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.verify_trusted_device(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.bind_or_verify_trusted_device(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_device_recovery_code(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.consume_device_recovery_code(text, text, text) TO authenticated, service_role;
