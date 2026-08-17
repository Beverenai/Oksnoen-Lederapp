import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Trash2, Plus, ListChecks, ArrowUp, ArrowDown, ChevronDown } from 'lucide-react';
import {
  useLeirskoleActivityTypes,
  useAddLeirskoleActivityType,
  useUpdateLeirskoleActivityType,
  useDeleteLeirskoleActivityType,
} from '@/hooks/useLeirskole';

export function LeirskoleActivityTypesCard() {
  const { data: types } = useLeirskoleActivityTypes();
  const add = useAddLeirskoleActivityType();
  const update = useUpdateLeirskoleActivityType();
  const remove = useDeleteLeirskoleActivityType();

  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [emoji, setEmoji] = useState('');

  const list = types ?? [];
  const activeCount = list.filter((t) => t.is_active).length;

  const addNew = () => {
    if (!label.trim()) {
      toast.error('Skriv inn et navn');
      return;
    }
    add.mutate(
      { label, emoji: emoji.trim() || '•', sortOrder: list.length },
      {
        onSuccess: () => {
          setLabel('');
          setEmoji('');
          toast.success('Aktivitet lagt til');
        },
        onError: () => toast.error('Kunne ikke legge til'),
      },
    );
  };

  const move = (index: number, dir: -1 | 1) => {
    const a = list[index];
    const b = list[index + dir];
    if (!a || !b) return;
    update.mutate({ id: a.id, sort_order: b.sort_order });
    update.mutate({ id: b.id, sort_order: a.sort_order });
  };

  return (
    <div className="oks-ls-pill overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <ListChecks className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Aktiviteter</span>
          <span className="block text-xs text-muted-foreground">
            {activeCount} aktive · {list.length} totalt
          </span>
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {open ? 'Lukk' : 'Åpne for å endre'}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="space-y-3 border-t border-border/60 p-4 pt-3">
          <p className="text-xs text-muted-foreground">
            Legg til aktivitetene lederne kan settes på. Slå av de du ikke bruker — historikken beholdes.
          </p>

          <div className="flex gap-1.5">
            <Input
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              placeholder="🛞"
              className="w-16 text-center"
              maxLength={4}
            />
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addNew()}
              placeholder="Ny aktivitet…"
              className="flex-1"
            />
            <Button onClick={addNew} disabled={add.isPending} className="gap-1 rounded-full">
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-1.5">
            {list.map((t, i) => (
              <div
                key={t.id}
                className={`flex items-center gap-2 rounded-2xl bg-muted/40 px-3 py-2 ${
                  t.is_active ? '' : 'opacity-60'
                }`}
              >
                <Input
                  value={t.emoji}
                  onChange={(e) => update.mutate({ id: t.id, emoji: e.target.value || '•' })}
                  className="h-8 w-12 border-none bg-transparent px-0 text-center"
                  maxLength={4}
                />
                <Input
                  defaultValue={t.label}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== t.label) update.mutate({ id: t.id, label: v });
                  }}
                  className="h-8 flex-1 border-none bg-transparent px-0 text-sm font-medium"
                />
                <div className="flex items-center gap-0.5">
                  <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Opp" onClick={() => move(i, -1)}>
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Ned" onClick={() => move(i, 1)}>
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Switch
                  checked={t.is_active}
                  onCheckedChange={(v) => update.mutate({ id: t.id, is_active: v })}
                  aria-label="Aktiv"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  aria-label="Slett"
                  onClick={() => {
                    if (confirm(`Slette "${t.label}"?`)) remove.mutate(t.id);
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
            {list.length === 0 && (
              <p className="py-4 text-center text-xs text-muted-foreground">Ingen aktiviteter lagt inn ennå.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
