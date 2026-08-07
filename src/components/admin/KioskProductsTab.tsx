import { useState } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Plus, Trash2, ShoppingBasket } from 'lucide-react';
import { useKioskCatalog } from '@/hooks/useKiosk';

export function KioskProductsTab() {
  const { data: catalog, isLoading } = useKioskCatalog(true);
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newCategory, setNewCategory] = useState<string>('');

  const refresh = () => qc.invalidateQueries({ queryKey: ['kiosk-catalog'] });

  const categories = catalog?.categories ?? [];
  const products = catalog?.products ?? [];

  const updateProduct = async (id: string, patch: Record<string, unknown>) => {
    const { error } = await supabase.from('kiosk_products').update(patch).eq('id', id);
    if (error) toast.error('Kunne ikke lagre', { description: error.message });
    else refresh();
  };

  const addProduct = async () => {
    const price = Number(newPrice);
    if (!newName.trim() || !Number.isFinite(price)) {
      toast.error('Fyll inn navn og pris');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('kiosk_products').insert({
      name: newName.trim(),
      price,
      category_id: newCategory || null,
    });
    setSaving(false);
    if (error) {
      toast.error('Kunne ikke legge til vare', { description: error.message });
      return;
    }
    setNewName('');
    setNewPrice('');
    toast.success('Vare lagt til');
    refresh();
  };

  const removeProduct = async (id: string) => {
    const { error } = await supabase.from('kiosk_products').delete().eq('id', id);
    if (error) toast.error('Kunne ikke slette', { description: error.message });
    else refresh();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Ny vare
          </CardTitle>
          <CardDescription>Legg inn navn, pris og kategori</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Navn</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Cola 0,5" />
            </div>
            <div className="space-y-1.5">
              <Label>Pris (kr)</Label>
              <Input
                type="number"
                inputMode="numeric"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                placeholder="35"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Kategori</Label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Ingen</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Button onClick={addProduct} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Legg til vare
          </Button>
        </CardContent>
      </Card>

      {categories.map((cat) => {
        const items = products.filter((p) => p.category_id === cat.id);
        if (items.length === 0) return null;
        return (
          <Card key={cat.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <span
                  className="h-4 w-4 rounded-full border border-border"
                  style={{ backgroundColor: cat.color }}
                />
                {cat.name} ({items.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {items.map((p) => (
                <div key={p.id} className="flex items-center gap-2">
                  <Input
                    defaultValue={p.name}
                    onBlur={(e) =>
                      e.target.value.trim() && e.target.value !== p.name
                        ? updateProduct(p.id, { name: e.target.value.trim() })
                        : undefined
                    }
                    className="min-w-0 flex-1"
                  />
                  <Input
                    type="number"
                    inputMode="numeric"
                    defaultValue={p.price}
                    onBlur={(e) =>
                      Number(e.target.value) !== p.price
                        ? updateProduct(p.id, { price: Number(e.target.value) })
                        : undefined
                    }
                    className="w-20 shrink-0 tabular-nums"
                  />
                  <Switch
                    checked={p.is_active}
                    onCheckedChange={(checked) => updateProduct(p.id, { is_active: checked })}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0 text-destructive"
                    onClick={() => removeProduct(p.id)}
                    aria-label="Slett vare"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}

      {products.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
            <ShoppingBasket className="h-8 w-8" />
            <p className="text-sm">Ingen varer i Gomla ennå</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}