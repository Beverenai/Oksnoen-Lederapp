import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, Plus } from 'lucide-react';
import {
  useSaveLeirskoleCompetencies,
  useLeirskoleActivityTypes,
  useAddLeirskoleActivityType,
} from '@/hooks/useLeirskole';
import { LEIRSKOLE_COMPETENCIES } from '@/lib/leirskoleCompetencies';

function slugify(label: string) {
  return (
    label
      .toLowerCase()
      .replace(/[æå]/g, 'a')
      .replace(/ø/g, 'o')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '') || `aktivitet_${Date.now()}`
  );
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leaderId: string;
  leaderName?: string;
  current: string[];
  /** Første gang: må velge minst én før man kan lukke. */
  required?: boolean;
  /** Marker at lederen selv har bekreftet kompetansen. */
  confirm?: boolean;
}

export function LeirskoleCompetenceSheet({
  open,
  onOpenChange,
  leaderId,
  leaderName,
  current,
  required = false,
  confirm = false,
}: Props) {
  const [selected, setSelected] = useState<string[]>(current);
  const save = useSaveLeirskoleCompetencies();
  const { data: types } = useLeirskoleActivityTypes();
  const addType = useAddLeirskoleActivityType();
  const [newLabel, setNewLabel] = useState('');
  const [newEmoji, setNewEmoji] = useState('');

  /** Alle aktiviteter — både nye fra databasen og de gamle standardene. */
  const options = (() => {
    const list = (types ?? []).map((t) => ({ key: t.key, label: t.label, emoji: t.emoji ?? '•' }));
    const seen = new Set(list.map((o) => o.key));
    LEIRSKOLE_COMPETENCIES.forEach((c) => {
      if (!seen.has(c.key)) {
        seen.add(c.key);
        list.push({ key: c.key, label: c.label, emoji: c.emoji });
      }
    });
    selected.forEach((k) => {
      if (!seen.has(k)) {
        seen.add(k);
        list.push({ key: k, label: k, emoji: '•' });
      }
    });
    return list;
  })();

  useEffect(() => {
    if (open) setSelected(current);
  }, [open, current]);

  const toggle = (key: string) =>
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const addActivity = async () => {
    const label = newLabel.trim();
    if (!label) return;
    if (options.some((o) => o.label.toLowerCase() === label.toLowerCase())) {
      toast.error('Aktiviteten finnes allerede');
      return;
    }
    try {
      await addType.mutateAsync({ label, emoji: newEmoji.trim() || '⭐', sortOrder: options.length });
      setSelected((prev) => [...prev, slugify(label)]);
      setNewLabel('');
      setNewEmoji('');
      toast.success('Aktivitet lagt til');
    } catch (e: any) {
      toast.error(e.message ?? 'Kunne ikke legge til');
    }
  };

  const submit = async () => {
    if (required && selected.length === 0) {
      toast.error('Velg minst én kompetanse');
      return;
    }
    try {
      await save.mutateAsync({ leaderId, competencies: selected, confirm });
      toast.success('Kompetanse lagret');
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? 'Kunne ikke lagre');
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (!v && required && selected.length === 0) return;
        onOpenChange(v);
      }}
    >
      <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto rounded-t-3xl">
        <SheetHeader className="text-left">
          <SheetTitle>Din kompetanse{leaderName ? ` · ${leaderName}` : ''}</SheetTitle>
          <SheetDescription>
            Hva kan du ha ansvar for på leirskolen? Dette brukes når vaktplanen settes opp.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {options.map((c) => {
            const active = selected.includes(c.key);
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => toggle(c.key)}
                className={`relative flex flex-col items-start gap-1 rounded-2xl border p-3 text-left transition-colors ${
                  active ? 'border-primary bg-primary/10' : 'border-border/60 bg-card/60'
                }`}
              >
                <span className="text-xl" aria-hidden>{c.emoji}</span>
                <span className="text-sm font-medium">{c.label}</span>
                {active && <Check className="absolute right-2 top-2 h-4 w-4 text-primary" />}
              </button>
            );
          })}
        </div>

        <div className="mt-3 rounded-2xl border border-dashed border-border/60 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Legg til aktivitet
          </p>
          <div className="flex gap-2">
            <Input
              value={newEmoji}
              onChange={(e) => setNewEmoji(e.target.value)}
              placeholder="⭐"
              className="w-16 text-center"
              maxLength={4}
            />
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Navn på aktivitet"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addActivity();
                }
              }}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={addActivity}
              disabled={!newLabel.trim() || addType.isPending}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mt-5 flex gap-2 pb-2">
          {!required && (
            <Button variant="secondary" className="flex-1" onClick={() => onOpenChange(false)}>
              Avbryt
            </Button>
          )}
          <Button className="flex-1" onClick={submit} disabled={save.isPending}>
            {save.isPending ? 'Lagrer…' : 'Lagre'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
