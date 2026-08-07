import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useActivePeriodId } from './useActivePeriodId';

export interface KioskCategory {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  is_active: boolean;
}

export interface KioskProduct {
  id: string;
  name: string;
  price: number;
  color: string | null;
  category_id: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface KioskBalance {
  participant_id: string;
  deposited: number;
  spent: number;
  balance: number;
}

export interface CartLine {
  product: KioskProduct;
  quantity: number;
}

export interface KioskSale {
  id: string;
  participant_id: string;
  total: number;
  created_at: string;
  voided_at: string | null;
  sold_by: string | null;
  items: { product_name: string; unit_price: number; quantity: number }[];
}

/** Categories + products for the kiosk POS. */
export function useKioskCatalog(includeInactive = false) {
  return useQuery({
    queryKey: ['kiosk-catalog', includeInactive],
    queryFn: async () => {
      const [cats, prods] = await Promise.all([
        supabase.from('kiosk_categories').select('*').order('sort_order'),
        supabase.from('kiosk_products').select('*').order('sort_order'),
      ]);
      if (cats.error) throw cats.error;
      if (prods.error) throw prods.error;
      const categories = (cats.data || []) as KioskCategory[];
      const products = (prods.data || []) as KioskProduct[];
      return {
        categories: includeInactive ? categories : categories.filter((c) => c.is_active),
        products: includeInactive ? products : products.filter((p) => p.is_active),
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Balance per participant for the active period. */
export function useKioskBalances() {
  const { data: periodId } = useActivePeriodId();

  return useQuery({
    queryKey: ['kiosk-balances', periodId ?? 'none'],
    enabled: !!periodId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kiosk_balances')
        .select('*')
        .eq('period_id', periodId!);
      if (error) throw error;
      const map = new Map<string, KioskBalance>();
      (data || []).forEach((row: any) => {
        if (!row.participant_id) return;
        map.set(row.participant_id, {
          participant_id: row.participant_id,
          deposited: Number(row.deposited ?? 0),
          spent: Number(row.spent ?? 0),
          balance: Number(row.balance ?? 0),
        });
      });
      return map;
    },
    staleTime: 15_000,
  });
}

/** Sales list — all recent sales, or all sales for one participant. */
export function useKioskSales(participantId?: string) {
  const { data: periodId } = useActivePeriodId();

  return useQuery({
    queryKey: ['kiosk-sales', periodId ?? 'none', participantId ?? 'all'],
    enabled: !!periodId,
    queryFn: async (): Promise<KioskSale[]> => {
      let query = supabase
        .from('kiosk_sales')
        .select('*, kiosk_sale_items(product_name, unit_price, quantity)')
        .eq('period_id', periodId!)
        .order('created_at', { ascending: false });
      if (participantId) query = query.eq('participant_id', participantId);
      else query = query.limit(100);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((s: any) => ({
        id: s.id,
        participant_id: s.participant_id,
        total: Number(s.total ?? 0),
        created_at: s.created_at,
        voided_at: s.voided_at,
        sold_by: s.sold_by,
        items: (s.kiosk_sale_items || []).map((i: any) => ({
          product_name: i.product_name,
          unit_price: Number(i.unit_price ?? 0),
          quantity: Number(i.quantity ?? 1),
        })),
      }));
    },
    staleTime: 10_000,
  });
}

function useInvalidateKiosk() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['kiosk-balances'] });
    qc.invalidateQueries({ queryKey: ['kiosk-sales'] });
  };
}

/** Records a sale atomically and returns the new sale id. */
export function useRecordKioskSale() {
  const invalidate = useInvalidateKiosk();

  return useMutation({
    mutationFn: async ({ participantId, lines }: { participantId: string; lines: CartLine[] }) => {
      const { data, error } = await supabase.rpc('record_kiosk_sale', {
        _participant_id: participantId,
        _items: lines.map((l) => ({ product_id: l.product.id, quantity: l.quantity })),
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: invalidate,
  });
}

export function useVoidKioskSale() {
  const invalidate = useInvalidateKiosk();

  return useMutation({
    mutationFn: async (saleId: string) => {
      const { error } = await supabase.rpc('void_kiosk_sale', { _sale_id: saleId });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

/** Adds money (or a correction) to a participant's kiosk account. */
export function useAddKioskDeposit() {
  const invalidate = useInvalidateKiosk();

  return useMutation({
    mutationFn: async ({
      participantId,
      amount,
      note,
    }: {
      participantId: string;
      amount: number;
      note?: string;
    }) => {
      const { error } = await supabase.from('kiosk_deposits').insert({
        participant_id: participantId,
        amount,
        kind: 'manual',
        note: note || null,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}