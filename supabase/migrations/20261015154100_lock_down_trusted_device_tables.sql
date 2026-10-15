-- Stage 2: the app has been switched to the trusted-device RPCs before applying this migration.
REVOKE ALL PRIVILEGES ON TABLE public.user_devices FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.device_recovery_codes FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS users_manage_own_devices ON public.user_devices;
DROP POLICY IF EXISTS users_delete_own_recovery_codes ON public.device_recovery_codes;
DROP POLICY IF EXISTS users_insert_own_recovery_codes ON public.device_recovery_codes;
DROP POLICY IF EXISTS users_manage_own_recovery_codes ON public.device_recovery_codes;
DROP POLICY IF EXISTS users_update_own_recovery_codes ON public.device_recovery_codes;