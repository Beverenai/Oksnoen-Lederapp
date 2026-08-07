CREATE TRIGGER set_period_id_kiosk_sales BEFORE INSERT ON public.kiosk_sales FOR EACH ROW EXECUTE FUNCTION public.set_period_id_default();
CREATE TRIGGER set_period_id_kiosk_deposits BEFORE INSERT ON public.kiosk_deposits FOR EACH ROW EXECUTE FUNCTION public.set_period_id_default();
CREATE TRIGGER update_kiosk_sales_updated_at BEFORE UPDATE ON public.kiosk_sales FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_kiosk_deposits_updated_at BEFORE UPDATE ON public.kiosk_deposits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_kiosk_products_updated_at BEFORE UPDATE ON public.kiosk_products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_kiosk_categories_updated_at BEFORE UPDATE ON public.kiosk_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();