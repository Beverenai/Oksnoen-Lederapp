import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Circle, Users } from 'lucide-react';
import { SnusCan3D } from '@/components/snus/SnusCan3D';
import { SnusCanRotator, snusProductsFrom } from '@/components/snus/SnusCanRotator';
import { SnusPicker } from '@/components/snus/SnusPicker';
import { getSnusProduct, customSnusProduct, snusLabel, snusFullName } from '@/lib/snusCatalog';
import { useStatusPopup } from '@/hooks/useStatusPopup';

type Brother = {
  id: string;
  name: string;
  profile_image_url: string | null;
  sharedIds: string[];
};

/**
 * Egen snus-side. Tilgjengelig også off-season / for inaktive ledere,
 * slik at snus og "snus brothers" er ett trykk unna fra hjem.
 */
export default function SnusPage() {
  const { leader, effectiveLeader } = useAuth();
  const { showError } = useStatusPopup();
  const me = effectiveLeader ?? leader;

  const [snusUser, setSnusUser] = useState(false);
  const [productId, setProductId] = useState<string | null>(null);
  const [productIds, setProductIds] = useState<string[]>([]);
  const [customLabel, setCustomLabel] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [brothers, setBrothers] = useState<Brother[]>([]);
  const [iAmActive, setIAmActive] = useState(true);

  const cans = snusProductsFrom(productIds.length ? productIds : [productId], customLabel);
  const can = cans[0] ?? null;

  const load = async () => {
    if (!me?.id) return;
    const { data } = await supabase
      .from('leaders')
      .select('snus_user, snus_product_id, snus_product_ids, snus_custom_label, is_active')
      .eq('id', me.id)
      .maybeSingle();
    setSnusUser(!!data?.snus_user);
    setIAmActive((data as any)?.is_active !== false);
    setProductId(data?.snus_product_id ?? null);
    setProductIds(((data as any)?.snus_product_ids as string[] | null) ?? []);
    setCustomLabel(data?.snus_custom_label ?? null);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [me?.id]);

  // Snus brothers – off-season teller også inaktive ledere
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const myIds = productIds.length ? productIds : productId ? [productId] : [];
      if (!me?.id || !snusUser || myIds.length === 0) { setBrothers([]); return; }
      // Aktive ledere ser kun aktive snus brothers; inaktive ser alle
      let query = supabase
        .from('leaders')
        .select('id, name, profile_image_url, snus_product_id, snus_product_ids')
        .eq('snus_user', true)
        .neq('id', me.id);
      if (iAmActive) query = query.eq('is_active', true);
      const { data } = await query.order('name');
      // Man er snus brothers om man deler minst én boks
      const matches = ((data as any[]) ?? []).flatMap((l) => {
        const ids: string[] = (l.snus_product_ids as string[] | null)?.length
          ? (l.snus_product_ids as string[])
          : l.snus_product_id
            ? [l.snus_product_id]
            : [];
        const shared = ids.filter((id) => myIds.includes(id));
        if (shared.length === 0) return [];
        return [{
          id: l.id,
          name: l.name,
          profile_image_url: l.profile_image_url,
          sharedIds: shared,
        } as Brother];
      });
      if (!cancelled) setBrothers(matches);
    };
    run();
    return () => { cancelled = true; };
  }, [me?.id, snusUser, productId, productIds, iAmActive]);

  const save = async (patch: {
    snus_user?: boolean;
    snus_product_id?: string | null;
    snus_product_ids?: string[];
    snus_custom_label?: string | null;
  }) => {
    if (!leader?.id) return;
    const { error } = await supabase.from('leaders').update(patch as never).eq('id', leader.id);
    if (error) showError('Kunne ikke lagre snus-valg', error.message);
  };

  return (
    <div className="oks-offseason-bg mx-auto -mx-4 w-full max-w-2xl space-y-6 px-4 pb-8 pt-1">
      <header className="pt-1">
        <h1 className="text-[26px] font-heading font-bold leading-tight text-foreground">Snus</h1>
        <span className="mt-2 mb-1.5 block h-1 w-10 rounded-full bg-[var(--gradient-oks-sunset)]" />
        <p className="text-sm text-muted-foreground">
          Velg boksen din – da ser andre ledere hvem de kan bomme av.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Circle className="w-5 h-5" />
            Min boks
          </CardTitle>
          <CardDescription>Velg gjerne flere bokser – de roterer automatisk</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="snusUserPage" className="text-base">Snuser du?</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{snusUser ? 'Ja' : 'Nei'}</span>
              <Switch
                id="snusUserPage"
                checked={snusUser}
                onCheckedChange={(checked) => {
                  setSnusUser(checked);
                  if (!checked) {
                    setProductId(null);
                    setProductIds([]);
                    setCustomLabel(null);
                    save({ snus_user: false, snus_product_id: null, snus_product_ids: [], snus_custom_label: null });
                  } else {
                    save({ snus_user: true });
                  }
                }}
              />
            </div>
          </div>

          {snusUser && (
            <div className="space-y-3">
              {can ? (
                <>
                  <div className="flex justify-center rounded-2xl bg-muted/40 py-4">
                    {cans.length > 1 ? (
                      <SnusCanRotator productIds={productIds} size={220} />
                    ) : (
                      <SnusCan3D product={can} size={220} />
                    )}
                  </div>
                  <p className="text-center text-sm font-semibold">
                    {cans.length > 1
                      ? cans.map(snusFullName).join(' • ')
                      : snusLabel(productId, customLabel)}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Velg hvilken boks du snuser.</p>
              )}
              <Button variant="outline" className="w-full" onClick={() => setPickerOpen(true)}>
                {can ? 'Endre snusbokser' : 'Velg snusboks'}
              </Button>
            </div>
          )}

          <SnusPicker
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            multi
            selectedId={productId}
            selectedIds={productIds.length ? productIds : productId ? [productId] : []}
            customLabel={customLabel}
            onSelectMany={(ids, custom) => {
              setProductIds(ids);
              setProductId(ids[0] ?? null);
              setCustomLabel(custom);
              save({
                snus_user: true,
                snus_product_id: ids[0] ?? null,
                snus_product_ids: ids,
                snus_custom_label: custom,
              });
            }}
            onSelect={(id, custom) => {
              setProductId(id);
              setProductIds(id ? [id] : []);
              setCustomLabel(custom);
              save({ snus_user: true, snus_product_id: id, snus_product_ids: id ? [id] : [], snus_custom_label: custom });
            }}
          />
        </CardContent>
      </Card>

      {snusUser && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Snus brothers ({brothers.length})
            </CardTitle>
          <CardDescription>Ledere som deler minst én boks med deg</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {brothers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Ingen andre har valgt samme boks – ennå.
              </p>
            ) : (
              brothers.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-3 py-2"
                >
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={b.profile_image_url || undefined} alt={b.name} />
                    <AvatarFallback className="text-xs">
                      {b.name?.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{b.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {b.sharedIds
                        .map((id) => getSnusProduct(id))
                        .filter(Boolean)
                        .map((p) => snusFullName(p!))
                        .join(' • ')}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}