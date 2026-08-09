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
import { SnusPicker } from '@/components/snus/SnusPicker';
import { getSnusProduct, customSnusProduct, snusLabel } from '@/lib/snusCatalog';
import { useStatusPopup } from '@/hooks/useStatusPopup';

type Brother = { id: string; name: string; profile_image_url: string | null };

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
  const [customLabel, setCustomLabel] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [brothers, setBrothers] = useState<Brother[]>([]);

  const can = productId
    ? getSnusProduct(productId)
    : customLabel?.trim()
      ? customSnusProduct(customLabel.trim())
      : null;

  const load = async () => {
    if (!me?.id) return;
    const { data } = await supabase
      .from('leaders')
      .select('snus_user, snus_product_id, snus_custom_label')
      .eq('id', me.id)
      .maybeSingle();
    setSnusUser(!!data?.snus_user);
    setProductId(data?.snus_product_id ?? null);
    setCustomLabel(data?.snus_custom_label ?? null);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [me?.id]);

  // Snus brothers – off-season teller også inaktive ledere
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!me?.id || !snusUser || !productId) { setBrothers([]); return; }
      const { data } = await supabase
        .from('leaders')
        .select('id, name, profile_image_url')
        .eq('snus_user', true)
        .eq('snus_product_id', productId)
        .neq('id', me.id)
        .order('name');
      if (!cancelled) setBrothers((data as Brother[]) ?? []);
    };
    run();
    return () => { cancelled = true; };
  }, [me?.id, snusUser, productId]);

  const save = async (patch: {
    snus_user?: boolean;
    snus_product_id?: string | null;
    snus_custom_label?: string | null;
  }) => {
    if (!leader?.id) return;
    const { error } = await supabase.from('leaders').update(patch).eq('id', leader.id);
    if (error) showError('Kunne ikke lagre snus-valg', error.message);
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 pb-6">
      <header className="pt-1">
        <h1 className="text-2xl font-heading font-bold text-foreground">Snus</h1>
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
          <CardDescription>Du kan bytte boks når du vil</CardDescription>
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
                    setCustomLabel(null);
                    save({ snus_user: false, snus_product_id: null, snus_custom_label: null });
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
                    <SnusCan3D product={can} size={220} />
                  </div>
                  <p className="text-center text-sm font-semibold">
                    {snusLabel(productId, customLabel)}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Velg hvilken boks du snuser.</p>
              )}
              <Button variant="outline" className="w-full" onClick={() => setPickerOpen(true)}>
                {can ? 'Bytt snusboks' : 'Velg snusboks'}
              </Button>
            </div>
          )}

          <SnusPicker
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            selectedId={productId}
            customLabel={customLabel}
            onSelect={(id, custom) => {
              setProductId(id);
              setCustomLabel(custom);
              save({ snus_user: true, snus_product_id: id, snus_custom_label: custom });
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
            <CardDescription>Ledere som snuser samme boks som deg</CardDescription>
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
                  <span className="text-sm font-medium">{b.name}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}