REVOKE EXECUTE ON FUNCTION public.record_kiosk_sale(uuid, jsonb) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.void_kiosk_sale(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.record_kiosk_sale(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.void_kiosk_sale(uuid) TO authenticated, service_role;