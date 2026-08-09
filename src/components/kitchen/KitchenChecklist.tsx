import { useState } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { hapticImpact } from '@/lib/capacitorHaptics';
import type { KitchenCheck, KitchenItem } from '@/hooks/useKitchen';
import { useKitchenAdmin, useToggleKitchenItem } from '@/hooks/useKitchen';

interface Props {
  sectionId: string;
  items: KitchenItem[];
  checks: Record<string, KitchenCheck>;
  leaderNames: Record<string, string>;
  canEdit: boolean;
}

export function KitchenChecklist({ sectionId, items, checks, leaderNames, canEdit }: Props) {
  const toggle = useToggleKitchenItem();
  const { addItem, updateItem, deleteItem } = useKitchenAdmin();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editHint, setEditHint] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newHint, setNewHint] = useState('');
  const [adding, setAdding] = useState(false);

  const startEdit = (item: KitchenItem) => {
    setEditingId(item.id);
    setEditLabel(item.label);
    setEditHint(item.hint ?? '');
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await updateItem(editingId, { label: editLabel.trim(), hint: editHint.trim() || null });
    setEditingId(null);
  };

  const saveNew = async () => {
    const label = newLabel.trim();
    if (!label) return;
    const nextOrder = (items[items.length - 1]?.sort_order ?? 0) + 1;
    await addItem(sectionId, label, newHint.trim() || null, nextOrder);
    setNewLabel('');
    setNewHint('');
    setAdding(false);
  };

  return (
    <div className="space-y-1.5">
      {items.map((item) => {
        const check = checks[item.id];
        const done = !!check;
        const who = check?.checked_by ? leaderNames[check.checked_by] : null;

        if (editingId === item.id) {
          return (
            <div key={item.id} className="rounded-xl border border-border bg-card p-3 space-y-2">
              <Input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} placeholder="Oppgave" />
              <Input value={editHint} onChange={(e) => setEditHint(e.target.value)} placeholder="Hvordan / middel (valgfritt)" />
              <div className="flex gap-2">
                <Button size="sm" onClick={saveEdit}><Check className="w-4 h-4 mr-1" />Lagre</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}><X className="w-4 h-4" /></Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive ml-auto"
                  onClick={async () => { await deleteItem(item.id); setEditingId(null); }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          );
        }

        return (
          <div
            key={item.id}
            className={cn(
              'flex items-start gap-3 rounded-xl border p-3 transition-colors',
              done ? 'border-primary/30 bg-primary/5' : 'border-border/60 bg-card/70',
            )}
          >
            <Checkbox
              id={`item-${item.id}`}
              checked={done}
              className="mt-0.5"
              onCheckedChange={(c) => {
                hapticImpact('light');
                toggle.mutate({ itemId: item.id, checked: c === true });
              }}
            />
            <label htmlFor={`item-${item.id}`} className="flex-1 min-w-0 cursor-pointer">
              <span
                className={cn(
                  'block text-sm font-medium leading-snug',
                  done ? 'text-muted-foreground line-through' : 'text-foreground',
                )}
              >
                {item.label}
              </span>
              {item.hint && (
                <span className="block text-xs text-muted-foreground mt-0.5">{item.hint}</span>
              )}
              {done && (
                <span className="block text-[11px] text-primary mt-1">
                  {who ? `Gjort av ${who}` : 'Gjort'}
                  {check?.checked_at
                    ? ` · ${new Date(check.checked_at).toLocaleDateString('nb-NO', { day: '2-digit', month: 'short' })} ${new Date(check.checked_at).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}`
                    : ''}
                </span>
              )}
            </label>
            {canEdit && (
              <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => startEdit(item)}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        );
      })}

      {canEdit && (adding ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-3 space-y-2">
          <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Ny oppgave" autoFocus />
          <Input value={newHint} onChange={(e) => setNewHint(e.target.value)} placeholder="Hvordan / middel (valgfritt)" />
          <div className="flex gap-2">
            <Button size="sm" onClick={saveNew}>Legg til</Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Avbryt</Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" className="w-full" onClick={() => setAdding(true)}>
          <Plus className="w-4 h-4 mr-1" />Nytt punkt
        </Button>
      ))}

      {items.length === 0 && !canEdit && (
        <p className="text-sm text-muted-foreground">Ingen punkter lagt inn ennå.</p>
      )}
    </div>
  );
}